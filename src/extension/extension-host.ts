import * as Comlink from "comlink";
import { sendExposed, awaitExposed } from "./comlink-helper";
import * as ExtensionService from "./extension-service";
import * as ExtensionWorker from "./extension-worker";
import * as V1 from "./manifest/v1";

import { parseManifest } from "./manifest";

import { ASDK } from "../sdk/abstracts/sdk";
import { NSExtensionHost, endpointRightIdentifier, extensionIdentifier, extensionWorkerControllerIdentifier } from "./types";


// interface IUIEndpoint {
//
// }
//
// class UIEndpoint implements IUIEndpoint {
//
// }

export class Extension {
  identifier: extensionIdentifier;
  location: string | URL;
  manifest: V1.Manifest;
  entrypoint: File;
  icon: File;
  ui: Map<string, File> | undefined;
  classification: string; //official, development, malicious, unknown
  state: string; //dormant, active, quarantine
  blake3: Uint8Array;
  numericIdentifier: number | undefined;
  extensionWorkerControllerIdentifier: extensionWorkerControllerIdentifier | null;
  constructor(identifier: extensionIdentifier, location: string, manifest: V1.Manifest,
    entrypoint: File, icon: File, classification: string, state: string, blake3: Uint8Array,
    ui?: Map<string, File>, numericIdentifier?: number) {
    this.identifier = identifier;
    this.location = location;
    this.manifest = manifest;
    this.entrypoint = entrypoint;
    this.icon = icon;
    this.ui = ui;
    this.classification = classification;
    this.state = state;
    this.blake3 = blake3;
    this.numericIdentifier = numericIdentifier;
    this.extensionWorkerControllerIdentifier = null;
  }

}


export class EndpointLeft implements NSExtensionHost.IEndpointLeft {
  //Because there should only be one single instance of an EndpointLeft,
  //there is no need for any identifier.
  #extensionHost: ExtensionHost;
  constructor(extensionHost: ExtensionHost) {

    this.#extensionHost = extensionHost;
  }

  loadExtension(extensionIdentifier: extensionIdentifier): Promise<boolean> {
    return this.#extensionHost.loadExtension(extensionIdentifier);
  }

  unloadExtension(extensionIdentifier: extensionIdentifier): Promise<boolean> {
    return this.#extensionHost.unloadExtension(extensionIdentifier);
  }

  resolveExtensions(): Promise<void> {
    return this.#extensionHost.resolveExtensions();
  }
}

export class EndpointRight implements NSExtensionHost.IEndpointRight {
  static #currentIdentifier: endpointRightIdentifier = 0;
  #identifier: endpointRightIdentifier;
  #extensionHost: ExtensionHost;
  #extensionWorkerControllerIdentifier: extensionWorkerControllerIdentifier | undefined;

  constructor(extensionHost: ExtensionHost) {
    this.#identifier = EndpointRight.#currentIdentifier;
    EndpointRight.#currentIdentifier += 1;

    this.#extensionHost = extensionHost;
  }

  get identifier(): endpointRightIdentifier {
    return this.#identifier;
  }

  get extensionWorkerControllerIdentifier(): extensionWorkerControllerIdentifier | undefined {
    return this.#extensionWorkerControllerIdentifier;
  }

  set extensionWorkerControllerIdentifier(extensionWorkerControllerIdentifier: extensionWorkerControllerIdentifier) {
    if (this.#extensionWorkerControllerIdentifier !== undefined) return;
    this.#extensionWorkerControllerIdentifier = extensionWorkerControllerIdentifier;
  }
}

class ExtensionWorkerController {
  static #currentIdentifier: extensionWorkerControllerIdentifier = 0;
  identifier: extensionWorkerControllerIdentifier;
  worker: Worker | null;
  endpointRightIdentifier: endpointRightIdentifier | undefined;
  extensionIdentifier: extensionIdentifier | undefined;
  extensionWorkerEndpoint: Comlink.Remote<ExtensionWorker.EndpointLeft>;

  constructor(worker: Worker, extensionWorkerEndpoint: Comlink.Remote<ExtensionWorker.EndpointLeft>) {
    this.identifier = ExtensionWorkerController.#currentIdentifier;
    ExtensionWorkerController.#currentIdentifier += 1;
    this.worker = worker;
    this.extensionWorkerEndpoint = extensionWorkerEndpoint;
  }
}

class ExtensionHost implements NSExtensionHost.IEndpointLeft, NSExtensionHost.IEndpointRight {
  #extensionWorkerEndpoints: Map<endpointRightIdentifier, EndpointRight>;
  #extensionWorkerControllers: Map<extensionWorkerControllerIdentifier, ExtensionWorkerController>;
  #extensions: Map<extensionIdentifier, Extension>;

  #sdk: Comlink.Remote<ASDK>;

  #endpointLeft: EndpointLeft;
  #extensionServiceEndpointRight: Comlink.Remote<ExtensionService.EndpointRight>;

  constructor(extensionServiceEndpointRight: Comlink.Remote<ExtensionService.EndpointRight>, sdk: Comlink.Remote<ASDK>) {
    this.#extensionWorkerEndpoints = new Map<endpointRightIdentifier, EndpointRight>();
    this.#extensionWorkerControllers = new Map<extensionWorkerControllerIdentifier, ExtensionWorkerController>();
    this.#extensions = new Map<extensionIdentifier, Extension>();

    this.#sdk = sdk;

    this.#endpointLeft = new EndpointLeft(this as ExtensionHost);

    this.#extensionServiceEndpointRight = extensionServiceEndpointRight;
  }

  get endpointLeft() {
    return this.#endpointLeft;
  }

  async loadExtension(extensionIdentifier: extensionIdentifier): Promise<boolean> {

    //Early return if the extension is
    //1: undefined
    //2: in quarantine
    //3: already loaded
    const extension = this.#extensions.get(extensionIdentifier);
    if (extension === undefined || extension.state === "quarantine" || extension.state === "active") return false;


    //All extensions have to adhere to the ES Module format
    const worker = new Worker(new URL("./extension-worker.ts", import.meta.url), { type: "module" });

    //Create an endpoint for the worker
    const endpointRight = new EndpointRight(this as ExtensionHost);

    //Expose that endpoint
    Comlink.expose(endpointRight, worker);
    sendExposed(worker);

    //Await till the worker has exposed all it has
    await awaitExposed(worker);

    //Wrap the workers left endpoint
    const extensionWorkerEndpoint = Comlink.wrap<ExtensionWorker.EndpointLeft>(worker);

    //Directly utilize the endpoint and load the extension
    const didExtensionLoad = await extensionWorkerEndpoint.loadExtenion(extension.entrypoint);

    //If the operation failed, terminate the worker and return false
    if (!didExtensionLoad) {
      //If the extension was not loaded, kill the web worker
      worker.terminate();
      //And return false
      return false;
    };

    //Else we go ahead

    //The extension is now active
    extension.state = "active";

    //We create a controller and safe the worker as well as the extensionWorkerEndpoint
    const controller = new ExtensionWorkerController(worker, extensionWorkerEndpoint);

    //Saving cross identifier references
    controller.endpointRightIdentifier = endpointRight.identifier;
    endpointRight.extensionWorkerControllerIdentifier = controller.identifier;

    controller.extensionIdentifier = extension.identifier;
    extension.extensionWorkerControllerIdentifier = controller.identifier;

    //We add the controller and the endpoint we created to their own Maps
    this.#extensionWorkerControllers.set(controller.identifier, controller);
    this.#extensionWorkerEndpoints.set(endpointRight.identifier, endpointRight);

    return true;
  }

  //Praying that nothing fails while removing an Extension
  async unloadExtension(extensionIdentifier: extensionIdentifier): Promise<boolean> {
    //Early return if the extension is
    //1: undefined
    //2: there is no extensionWorkerControllerIdentifier
    //3: in quarantine
    //4: or dormant
    const extension = this.#extensions.get(extensionIdentifier);
    if (extension === undefined || extension.extensionWorkerControllerIdentifier === null ||
      extension.state === "quarantine" || extension.state === "dormant") return false;

    //Get the controller associated with the extension
    const controller = this.#extensionWorkerControllers.get(extension.extensionWorkerControllerIdentifier);
    //Check if it is actually valid and if there is an endpointRightIdentifier (which there should be)
    if (controller === undefined || controller.endpointRightIdentifier === undefined) return false;

    //Let the extension know it is being shut down
    await controller.extensionWorkerEndpoint.unloadExtension();

    //Kill the web worker
    controller.worker!.terminate();
    controller.worker = null;

    //Change the extensions state to dormant
    extension.state = "dormant";
    //And remove the reference to the ExtensionWorkerController
    extension.extensionWorkerControllerIdentifier = null;

    //Delete the endpoint that we exposed to the web worker
    if (!this.#extensionWorkerEndpoints.delete(controller.endpointRightIdentifier)) return false;

    //Delete the actual controller
    if (!this.#extensionWorkerControllers.delete(controller.identifier)) return false;
    return true;
  }

  async resolveExtensions(): Promise<void> {
    //Check if plugins exists and if not create the plugins dir and return
    if (!await this.#sdk.exists("plugins")) {
      await this.#sdk.mkdir("plugins");
      return;
    }

    //Read all the entries inside of the plugin dir
    const pluginDirectories = await this.#sdk.readDir("./plugins");

    //Iterate over all entries inside of ./plugins
    for (const directory of pluginDirectories) {
      //If error then continue to the next entry
      try {
        //If it is not a directory skip to the next entry
        if (!directory.isDirectory) continue;

        //The current plugins path
        const pluginPath = "./plugins/".concat(directory.name, "/");

        //The path to the plugin manifest
        const manifestPath = pluginPath.concat("manifest.json");
        //Check if the manifest actually exists
        if (!await this.#sdk.exists(manifestPath)) continue;

        //Create a textDecoder, to decode the manifest which is in an Uint8Array format
        //to a string representation
        const textDecoder = new TextDecoder();
        //Transform the raw u8 bytes to text and then parse it to a JSON object
        const rawManifest = await this.#sdk.readFile(manifestPath);
        const jsonManifestString = textDecoder.decode(rawManifest);
        const jsonManifest = JSON.parse(jsonManifestString);

        //Check the validity of the JSON manifest based on our manifest format
        const manifest = parseManifest(jsonManifest);
        if (manifest === null) continue;

        //Now we know what the entrypoint is called, so we check if it exists
        const entrypointPath = pluginPath.concat(manifest.entrypoint());
        //Skip this plugin if there is no actual entrypoint file
        if (!await this.#sdk.exists(entrypointPath)) continue;

        //Now we know what the icon is called, so we check if it exists
        const iconPath = pluginPath.concat(manifest.icon());
        //Skip this plugin if there is no actual icon file
        if (!await this.#sdk.exists(iconPath)) continue;

        //Read the entrypoint file
        const rawEntrypoint: Uint8Array = await this.#sdk.readFile(entrypointPath);
        //Create a File which is of type javascript
        const entrypoint = new File([rawEntrypoint], "entrypoint", { type: "text/javascript" });

        //Read the icon file
        const rawIcon = await this.#sdk.readFile(iconPath);
        //Create a File which is of type png
        const icon = new File([rawIcon], "icon", { type: "image/png" });

        //Grab all the ui files
        const uiRecord = manifest.ui();

        //Later on all the ui files will be stored in here with their
        //key as their identifier which is defined in the manifest
        let uiMap: Map<string, File> | undefined;

        //We also save the raw UI data because we are going to hash it
        let rawUIArray: Uint8Array[] = [];

        //If the UI record has entries we are going to process them
        if (uiRecord !== undefined) {
          //If there are some entries create a new Map
          uiMap = new Map<string, File>();

          //Iterate over all the keys of the UI object
          for (const key in uiRecord) {
            //Grab the value of the thang
            if (uiRecord.hasOwnProperty(key)) {
              //Specify the path of the current UI file
              const uiPath = pluginPath.concat(uiRecord[key]);

              //Now we know what the entrypoint is called, so we check if it exists
              if (!await this.#sdk.exists(uiPath)) {
                //It does not exist so we throw an Error and the catch clause will catch it and 
                //continue to the next plugin
                throw new Error(`[MANIFEST] ${uiPath} not found! Make sure it exists!`);
              }

              //Read the ui file
              const rawUI = await this.#sdk.readFile(uiPath);
              //Create a File which is of type html
              const ui = new File([rawUI], key, { type: "text/html" });
              //Insert it into our Map
              uiMap.set(key, ui);

              rawUIArray.push(rawUI);
            }
          }
        }

        //Merge all the raw data for the blake3 hash. (order is important)
        const hashData = mergeUint8Arrays(rawManifest, rawEntrypoint, rawIcon, ...rawUIArray);

        //Compute the blake3 hash
        const blake3 = await this.#sdk.blake3(hashData);


        //TODO: Create a DB table for the extensions and continue to implement the
        //flow chart here

        const extension = new Extension(
          manifest.identifier(),
          pluginPath,
          manifest,
          entrypoint,
          icon,
          "unknown",
          "dormant",
          blake3,
          uiMap
        );

        //Check if the extension has already been loaded, if yes skip it
        if (this.#extensions.has(extension.identifier)) continue;

        //Insert the Extension into our Map
        this.#extensions.set(extension.identifier, extension);

      } catch (error) {
        //Catch any error and print it
        console.error(error);
        //Continue with the next entry in our directory
        continue;
      }
    }
    console.log(this.#extensions);
  }

}

function mergeUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  // Calculate the total length of all arrays
  const totalLength = arrays.reduce((acc, array) => acc + array.length, 0);

  // Create a new Uint8Array with the total length
  const mergedArray = new Uint8Array(totalLength);

  // Copy each array into the new merged array
  let offset = 0;
  for (const array of arrays) {
    mergedArray.set(array, offset);
    offset += array.length;
  }

  return mergedArray;
}

////----------------------------------------------------------------------------------

await awaitExposed(self);
const { endpoint, sdk } = Comlink.wrap<ExtensionService.IExposeRight>(self);
const extensionHost = new ExtensionHost(endpoint, sdk);

Comlink.expose(extensionHost.endpointLeft, self);
sendExposed(self);
