import * as Comlink from "comlink";
import { sendExposed, awaitExposed } from "./comlink-helper";
import * as ExtensionService from "./extension-service";
import * as V1 from "./manifest/v1";

import { parseManifest } from "./manifest";

import { ASDK } from "../sdk/abstracts/sdk";
import { exists } from "@tauri-apps/plugin-fs";

export type endpointRightIdentifier = number;
export type endpointLeftIdentifier = number;
export type extensionWorkerControllerIdentifier = number;
export type extensionIdentifier = string;

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
  entrypoint: File | undefined;
  icon: File | undefined;
  ui: Map<string, File> | undefined;
  classification: string; //official, development, malicious, unknown
  state: string; //dormant, active, quarantine
  blake3: Uint8Array;
  numericIdentifier: number | undefined;
  extensionWorkerControllerIdentifier: extensionWorkerControllerIdentifier | undefined;
  constructor(identifier: extensionIdentifier, location: string, manifest: V1.Manifest,
    classification: string, state: string, blake3: Uint8Array,
    entrypoint?: File, icon?: File, ui?: Map<string, File>, numericIdentifier?: number) {
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
    this.extensionWorkerControllerIdentifier = undefined;
  }

  // static async new(location: string): Promise<Extension | null> {
  //   //TODO: Replace with the new SDK function wrapper
  //   //if (!await readFile(location.concat("/", "manifest.json"))) return null;
  //
  //   return null;
  // }
}

interface IEndpointLeft {
  //Add more ways of loading an Extension for example from a Server.
  //Also, because the Identifier of an extension has to be unique globally, we can just go by the extensionIdentifier;
  loadExtension(extensionIdentifier: extensionIdentifier): Promise<boolean>;
  unloadExtension(extensionIdentifier: extensionIdentifier): boolean;
  resolveExtensions(): Promise<void>;
}

interface IEndpointRight {
  // registerUI(html: string, extensionWorkerController?: ExtensionWorkerController): UIEndpoint;

}

export class EndpointLeft implements IEndpointLeft {
  static #currentIdentifier: endpointRightIdentifier = 0;
  #identifier: endpointRightIdentifier;

  #extensionHost: ExtensionHost;
  constructor(extensionHost: ExtensionHost) {
    this.#identifier = EndpointLeft.#currentIdentifier;
    EndpointLeft.#currentIdentifier += 1;

    this.#extensionHost = extensionHost;
  }

  loadExtension(extensionIdentifier: extensionIdentifier): Promise<boolean> {
    return this.#extensionHost.loadExtension(extensionIdentifier);
  }

  unloadExtension(extensionIdentifier: extensionIdentifier): boolean {
    return this.#extensionHost.unloadExtension(extensionIdentifier);
  }

  resolveExtensions(): Promise<void> {
    return this.#extensionHost.resolveExtensions();
  }
}

export class EndpointRight implements IEndpointRight {
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
  #endpointRightIdentifier: endpointRightIdentifier | undefined;
  constructor(worker: Worker) {
    this.identifier = ExtensionWorkerController.#currentIdentifier;
    ExtensionWorkerController.#currentIdentifier += 1;
    this.worker = worker;
  }

  get endpointRightIdentifier(): endpointRightIdentifier | undefined {
    return this.#endpointRightIdentifier;
  }

  set endpointRightIdentifier(endpointRightIdentifier: endpointRightIdentifier) {
    if (this.#endpointRightIdentifier !== undefined) return;
    this.#endpointRightIdentifier = endpointRightIdentifier;
  }

  //extensionWorkerEndpoint: Comlink.Remote<ExtensionWorker.EndpointLeft> | null;
}

class ExtensionHost implements IEndpointLeft, IEndpointRight {
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

    //Early return if the extension is already loaded
    //TODO: Rework
    //if (this.#extensionIdentifierControllerIdentifier.has(extensionIdentifier)) return false;

    //This might fails because of the path just so you know Amer
    const worker = new Worker(new URL("./extension-worker", import.meta.url), { type: "module" });

    const controller = new ExtensionWorkerController(worker);
    const endpointRight = new EndpointRight(this as ExtensionHost);

    //Saving cross identifier references
    controller.endpointRightIdentifier = endpointRight.identifier;
    endpointRight.extensionWorkerControllerIdentifier = controller.identifier;

    this.#extensionWorkerControllers.set(controller.identifier, controller);
    this.#extensionWorkerEndpoints.set(endpointRight.identifier, endpointRight);

    Comlink.expose(endpointRight, worker);
    sendExposed(worker);

    return true;
  }

  unloadExtension(extensionIdentifier: extensionIdentifier): boolean {
    //TODO: Rework

    // const extensionWorkerControllerIdentifier = this.#extensionIdentifierControllerIdentifier.get(extensionIdentifier);
    // if (extensionWorkerControllerIdentifier === undefined) return false;
    //
    // const controller = this.#extensionWorkerControllers.get(extensionWorkerControllerIdentifier);
    // if (controller === undefined || controller.endpointRightIdentifier === undefined) return false;
    //
    // if (!this.#extensionWorkerEndpoints.delete(controller.endpointRightIdentifier)) return false;
    //
    // controller.worker!.terminate();
    // controller.worker = null;
    //
    // if (!this.#extensionWorkerControllers.delete(controller.identifier)) return false;
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
          "unknown",
          "dormant",
          blake3,
          entrypoint,
          icon,
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
