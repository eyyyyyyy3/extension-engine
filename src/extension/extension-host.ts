import * as Comlink from "comlink";
import { sendExposed, awaitExposed } from "./comlink-helper";
import * as ExtensionService from "./extension-service";
import * as ExtensionWorker from "./extension-worker";
import * as V1 from "./manifest/v1";

import { parseManifest } from "./manifest";

import { ASDK } from "../sdk/abstracts/sdk";
import { NSExtensionHost, endpointRightIdentifier, eventIdentifier, eventListenerControllerIdentifier, extensionIdentifier, extensionState, extensionWorkerControllerIdentifier, spaceIdentifier, spaceZoneLocation, uiIdentifier, zoneIdentifier } from "./types";
import { ExtensionWorkerController } from "./controller/extension-worker-controller";
import { EventTargetController } from "./controller/event-target-controller";
import { UIController } from "./controller/ui-controller";


export class Extension {
  identifier: extensionIdentifier;
  location: string | URL;
  manifest: V1.Manifest;
  entrypoint: File;
  icon: File;
  ui: Map<uiIdentifier, File> | undefined;
  classification: string; //official, development, malicious, unknown
  state: extensionState; //dormant, active, quarantine
  blake3: Uint8Array;
  numericIdentifier: number | undefined;
  extensionWorkerControllerIdentifier: extensionWorkerControllerIdentifier | null;
  constructor(identifier: extensionIdentifier, location: string, manifest: V1.Manifest,
    entrypoint: File, icon: File, classification: string, state: extensionState, blake3: Uint8Array,
    ui?: Map<uiIdentifier, File>, numericIdentifier?: number) {
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

  extensionState(extensionIdentifier: extensionIdentifier): Promise<extensionState | null> {
    return this.#extensionHost.extensionState(extensionIdentifier);
  }

  registerEvent(event: eventIdentifier): Promise<boolean> {
    return this.#extensionHost.registerEvent(event);
  }

  emitEvent(event: eventIdentifier, data?: any): Promise<boolean> {
    return this.#extensionHost.emitEvent(event, data);
  }

  removeEvent(event: eventIdentifier): Promise<boolean> {
    return this.#extensionHost.removeEvent(event);

  }

  hasEventEL(event: eventIdentifier): Promise<boolean> {
    return this.#extensionHost.hasEventEL(event);
  }

  getEventsEL(): Promise<eventIdentifier[]> {
    return this.#extensionHost.getEventsEL();
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

  registerUI(uiIdentifier: uiIdentifier, space: spaceIdentifier, zone: zoneIdentifier, listener: ((data: any) => any) & Comlink.ProxyMarked): Promise<boolean> {
    return this.#extensionHost.registerUI(uiIdentifier, space, zone, listener, this.#identifier);
  }

  removeUI(uiIdentifier: uiIdentifier): Promise<boolean> {
    return this.#extensionHost.removeUI(uiIdentifier, this.#identifier);
  }

  postMessageUI(uiIdentifier: uiIdentifier, message: any): Promise<boolean> {
    return this.#extensionHost.postMessageUI(uiIdentifier, message, this.#identifier);
  }

  registerListener(event: eventIdentifier, listener: ((data: any) => any) & Comlink.ProxyMarked): Promise<eventListenerControllerIdentifier | null> {
    return this.#extensionHost.registerListener(event, listener, this.#identifier);
  }

  removeListener(eventListenerControllerIdentifier: eventListenerControllerIdentifier): Promise<boolean> {
    return this.#extensionHost.removeListener(eventListenerControllerIdentifier, this.#identifier);
  }

  hasListener(eventListenerControllerIdentifier: eventListenerControllerIdentifier): Promise<boolean> {
    return this.#extensionHost.hasListener(eventListenerControllerIdentifier, this.#identifier);
  }

  hasEventER(event: eventIdentifier): Promise<boolean> {
    return this.#extensionHost.hasEventER(event, this.#identifier);
  }

  getEventsER(): Promise<eventIdentifier[] | null> {
    return this.#extensionHost.getEventsER(this.#identifier);
  }
}

class ExtensionHost implements NSExtensionHost.IEndpointLeft, NSExtensionHost.IEndpointRight {
  #extensionWorkerEndpoints: Map<endpointRightIdentifier, EndpointRight>;
  #extensionWorkerControllers: Map<extensionWorkerControllerIdentifier, ExtensionWorkerController>;
  #extensions: Map<extensionIdentifier, Extension>;
  #uiControllers: Map<uiIdentifier, UIController>;
  #eventTarget: EventTargetController;

  #sdk: Comlink.Remote<ASDK>;

  #endpointLeft: EndpointLeft;
  #extensionServiceEndpointRight: Comlink.Remote<ExtensionService.EndpointRight>;

  constructor(extensionServiceEndpointRight: Comlink.Remote<ExtensionService.EndpointRight>, sdk: Comlink.Remote<ASDK>) {
    this.#extensionWorkerEndpoints = new Map<endpointRightIdentifier, EndpointRight>();
    this.#extensionWorkerControllers = new Map<extensionWorkerControllerIdentifier, ExtensionWorkerController>();
    this.#extensions = new Map<extensionIdentifier, Extension>();
    this.#uiControllers = new Map<uiIdentifier, UIController>();
    this.#eventTarget = new EventTargetController();

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
    //4: initializing

    const extension = this.#extensions.get(extensionIdentifier);
    if (extension === undefined || extension.state !== "dormant") return false;


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
    const isExtensionLoaded = await extensionWorkerEndpoint.loadExtenion(extension.entrypoint);

    //If the operation failed, terminate the worker and return false
    if (!isExtensionLoaded) {
      //If the extension was not loaded, kill the web worker
      worker.terminate();
      //And return false
      return false;
    };

    //Else we go ahead

    //The extension is now initializing
    extension.state = "initializing";

    //We create a controller and safe the worker as well as the extensionWorkerEndpoint
    const extensionWorkerController = new ExtensionWorkerController(worker, extensionWorkerEndpoint);

    //Saving cross identifier references
    //extensionWorkerController.endpointRightIdentifier safes the reference to the endpoint that will be exposed to the extension-worker
    extensionWorkerController.endpointRightIdentifier = endpointRight.identifier;
    //endpointRight.extensionWorkerControllerIdentifier safes the reference to the extensionWorkerController which is responsible for managing the endpoint
    endpointRight.extensionWorkerControllerIdentifier = extensionWorkerController.identifier;

    //TODO: Add comment here
    extensionWorkerController.extensionIdentifier = extension.identifier;
    extension.extensionWorkerControllerIdentifier = extensionWorkerController.identifier;

    //We add the controller and the endpoint we created to their own Maps
    this.#extensionWorkerControllers.set(extensionWorkerController.identifier, extensionWorkerController);
    this.#extensionWorkerEndpoints.set(endpointRight.identifier, endpointRight);

    //After all is done and set we run the Extension.
    //Its important to do that after everything manage wise 
    //has been done, because if it is not done that way, the extension
    //might call a function from the endpoint which has not yet registered the actual extension
    await extensionWorkerEndpoint.initializeExtension();
    extension.state = "active";
    return true;
  }

  //Praying that nothing fails while removing an Extension
  async unloadExtension(extensionIdentifier: extensionIdentifier): Promise<boolean> {
    //Early return if the extension is
    //1: undefined
    //2: there is no extensionWorkerControllerIdentifier
    //3: in quarantine
    //4: dormant
    //5: initializing

    const extension = this.#extensions.get(extensionIdentifier);
    if (extension === undefined || extension.extensionWorkerControllerIdentifier === null ||
      extension.state !== "active") return false;

    //Get the controller associated with the extension
    const extensionWorkerController = this.getExtensionWorkerController(extension.extensionWorkerControllerIdentifier);
    //Check if it is actually valid and if there is an endpointRightIdentifier (which there should be)
    if (extensionWorkerController === null || extensionWorkerController.endpointRightIdentifier === undefined) return false;

    //Let the extension know it is being shut down
    await extensionWorkerController.unloadExtension();
    for (const [_, uiController] of this.#uiControllers) {
      //Just deleting without checking if it worked cause we are already doing the thing
      //Deleting the IFrame also deletes all its attached eventListeners
      await this.#extensionServiceEndpointRight.removeIFrame(uiController.iFrameControllerIdentifier);
    }

    //Kill the web worker
    extensionWorkerController.worker!.terminate();
    extensionWorkerController.worker = null;


    //Delete the endpoint that we exposed to the web worker
    if (!this.#extensionWorkerEndpoints.delete(extensionWorkerController.endpointRightIdentifier)) return false;

    //Delete the actual controller
    if (!this.#extensionWorkerControllers.delete(extensionWorkerController.identifier)) return false;


    //Remove the reference to the ExtensionWorkerController
    extension.extensionWorkerControllerIdentifier = null;
    //Change the extensions state to dormant
    extension.state = "dormant";
    return true;
  }

  async resolveExtensions(): Promise<void> {
    //Check if extensions exists and if not create the extensions dir and return
    if (!await this.#sdk.exists("extensions")) {
      await this.#sdk.mkdir("extensions");
      return;
    }

    //Read all the entries inside of the extension dir
    const extensionDirectories = await this.#sdk.readDir("./extensions");

    //Iterate over all entries inside of ./extensions
    for (const directory of extensionDirectories) {
      //If error then continue to the next entry
      try {
        //If it is not a directory skip to the next entry
        if (!directory.isDirectory) continue;

        //The current extensions path
        const extensionPath = "./extensions/".concat(directory.name, "/");

        //The path to the extension manifest
        const manifestPath = extensionPath.concat("manifest.json");
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
        const entrypointPath = extensionPath.concat(manifest.entrypoint());
        //Skip this extension if there is no actual entrypoint file
        if (!await this.#sdk.exists(entrypointPath)) continue;

        //Now we know what the icon is called, so we check if it exists
        const iconPath = extensionPath.concat(manifest.icon());
        //Skip this extension if there is no actual icon file
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
        let uiMap: Map<uiIdentifier, File> | undefined;

        //We also save the raw UI data because we are going to hash it
        let rawUIArray: Uint8Array[] = [];

        //If the UI record has entries we are going to process them
        if (uiRecord !== undefined) {
          //If there are some entries create a new Map
          uiMap = new Map<uiIdentifier, File>();

          //Iterate over all the keys of the UI object
          for (const key in uiRecord) {
            //Grab the value of the thang
            if (uiRecord.hasOwnProperty(key)) {
              //Specify the path of the current UI file
              const uiPath = extensionPath.concat(uiRecord[key]);

              //Now we know what the entrypoint is called, so we check if it exists
              if (!await this.#sdk.exists(uiPath)) {
                //It does not exist so we throw an Error and the catch clause will catch it and 
                //continue to the next extension
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
          extensionPath,
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
  }

  async registerUI(uiIdentifier: uiIdentifier, space: spaceIdentifier, zone: zoneIdentifier, listener: ((data: any) => any) & Comlink.ProxyMarked, endpointRightIdentifier?: endpointRightIdentifier): Promise<boolean> {
    //TODO: Figure this out later. I need to check weather the ui already exists and it has to be extensionWorkerController specific
    const extensionWorkerController = this.getExtensionWorkerControllerOverEndpointIdentifier(endpointRightIdentifier);
    if (extensionWorkerController === null) return false;

    //Check if the ui is already loaded and if it is return false
    if (this.hasUI(uiIdentifier)) return false;

    //The failing of this should actually be impossible
    if (extensionWorkerController.extensionIdentifier === undefined) return false;

    //Get the extension from our Map
    const extension = this.#extensions.get(extensionWorkerController.extensionIdentifier);
    //Check if it exists
    if (extension === undefined) return false;

    //Check if there are any ui files registered for this extension
    if (extension.ui === undefined) return false;

    //Get the ui file that we defined with our uiIdentifier
    const ui = extension.ui.get(uiIdentifier);
    //Check if it exists
    if (ui === undefined) return false;

    const spaceZoneLocation: spaceZoneLocation = [space, zone];

    //Check whether the spaceZoneLocation exists or not
    const hasSpaceZone = await this.#extensionServiceEndpointRight.hasSpaceZone(spaceZoneLocation);
    if (!hasSpaceZone) return false;

    //Register the IFrame with our ui file and the spaceZoneLocation
    const iFrameControllerIdentifier = await this.#extensionServiceEndpointRight.registerIFrame(ui, spaceZoneLocation);
    if (iFrameControllerIdentifier === null) return false;

    //Register the listener to our newly created iFrame
    const eventListenerControllerIdentifier = await this.#extensionServiceEndpointRight.registerListener(iFrameControllerIdentifier, listener);
    //If this fails we remove the created iFrame and return false
    if (eventListenerControllerIdentifier === null) {
      await this.#extensionServiceEndpointRight.removeIFrame(iFrameControllerIdentifier);
      return false;
    }

    //Create an uiController which holds the iFrameControllerIdentifier and eventListenerControllerIdentifier
    const uiController = new UIController(uiIdentifier, iFrameControllerIdentifier, eventListenerControllerIdentifier);

    //Save it to the extensionWorkerController's specific registerUIControllerIdentifier Set.
    this.#uiControllers.set(uiController.identifier, uiController);

    //Register the UIController to its extensionWorkerController
    return extensionWorkerController.registerUIControllerIdentifier(uiController.identifier);
  }

  async removeUI(uiIdentifier: uiIdentifier, endpointRightIdentifier?: endpointRightIdentifier): Promise<boolean> {
    //TODO: Fix this code as it does not check if the uiController belongs to the ExtensionWorker.
    //Actually we have to check from the UIControllers side as there may be n-many uiIdentifiers with the same name.
    //Actually Actually registering an ui has to return some kind of identifier which is unique as doing it otherwise
    //would lead to having only one instance of a ui with that name which we want to prevent
    const extensionWorkerController = this.getExtensionWorkerControllerOverEndpointIdentifier(endpointRightIdentifier);
    if (extensionWorkerController === null) return false;

    //Get the UIController from our extensionWorkerController's uiControllers Map
    const uiController = this.getUIController(uiIdentifier);
    //Check if it exists and if it does not return false as this means that there is not any UI
    //loaded with that identifier
    if (uiController === null) return false;


    //Remove the created IFrame (and with it all its listeners and space registries);
    if (!await this.#extensionServiceEndpointRight.removeIFrame(uiController.iFrameControllerIdentifier)) return false;

    //Remove the uiControllerIdentifier from extensionWorkerController's 
    //Set and our uiController Map
    extensionWorkerController.removeUIControllerIdentifier(uiController.identifier);
    return this.#uiControllers.delete(uiIdentifier);
  }

  async postMessageUI(uiIdentifier: uiIdentifier, message: any, endpointRightIdentifier?: endpointRightIdentifier): Promise<boolean> {
    const extensionWorkerController = this.getExtensionWorkerControllerOverEndpointIdentifier(endpointRightIdentifier);
    if (extensionWorkerController === null) return false;

    //Get the UIController from our extensionWorkerController's uiControllers Map
    const uiController = this.getUIController(uiIdentifier);
    //Check if it exists and if it does not return false as this means that there is not any UI
    //loaded with that identifier
    if (uiController === null) return false;


    //PostMessage the data to it and return whether it was successful or not
    return await this.#extensionServiceEndpointRight.postMessage(uiController.iFrameControllerIdentifier, message);
  }

  async extensionState(extensionIdentifier: extensionIdentifier): Promise<extensionState | null> {
    const extension = this.#extensions.get(extensionIdentifier);
    if (extension === undefined || extension.state !== "dormant") return null;
    return extension.state;
  }

  async registerEvent(event: eventIdentifier): Promise<boolean> {
    return this.#eventTarget.registerEvent(event);
  }

  async emitEvent(event: eventIdentifier, data?: any): Promise<boolean> {
    return this.#eventTarget.emitEvent(event, data);
  }

  async removeEvent(event: eventIdentifier): Promise<boolean> {
    //TODO: Continue here.
    //When removing the event all the references to the listener
    //inside of the workers should be removed too.
    //Either add a reference to the extension-host (and thus
    //to keep it consistent, add a reference to extension-xxx 
    //to every controller which is referenced by extenion-xxx)
    //or just dont do it and tell the user that the reference might be invalid.
    return this.#eventTarget.removeEvent(event);
  }

  async hasEventEL(event: eventIdentifier): Promise<boolean> {
    return this.#eventTarget.hasEvent(event);
  }

  async getEventsEL(): Promise<eventIdentifier[]> {
    return this.#eventTarget.getEvents();
  }


  async registerListener(event: eventIdentifier, listener: ((data: any) => any) & Comlink.ProxyMarked, endpointRightIdentifier?: endpointRightIdentifier): Promise<eventListenerControllerIdentifier | null> {
    const extensionWorkerController = this.getExtensionWorkerControllerOverEndpointIdentifier(endpointRightIdentifier);
    if (extensionWorkerController === null) return null;

    const eventListenerControllerIdentifier = this.#eventTarget.registerListener(event, listener);
    if (eventListenerControllerIdentifier === null) return null;

    const hasEventListenerControllerIdentifierRegistered = extensionWorkerController.registerEventListenerControllerIdentifier(eventListenerControllerIdentifier);
    //TODO: In every case where the extension-xxx-controller could not register, we have to remove everything
    //we did above
    if (!hasEventListenerControllerIdentifierRegistered) return null;

    return eventListenerControllerIdentifier;
  }

  async removeListener(eventListenerControllerIdentifier: eventListenerControllerIdentifier, endpointRightIdentifier?: endpointRightIdentifier): Promise<boolean> {
    const extensionWorkerController = this.getExtensionWorkerControllerOverEndpointIdentifier(endpointRightIdentifier);
    if (extensionWorkerController === null) return false;

    const wasEventListenerControllerIdentifierRemoved = extensionWorkerController.removeEventListenerControllerIdentifier(eventListenerControllerIdentifier);
    if (!wasEventListenerControllerIdentifierRemoved) return false;

    return this.#eventTarget.removeListener(eventListenerControllerIdentifier);
  }

  async hasListener(eventListenerControllerIdentifier: eventListenerControllerIdentifier, endpointRightIdentifier?: endpointRightIdentifier): Promise<boolean> {
    const extensionWorkerController = this.getExtensionWorkerControllerOverEndpointIdentifier(endpointRightIdentifier);
    if (extensionWorkerController === null) return false;

    //First we check if the extensionHostController has that Identifier
    const hasEventListenerControllerIdentifier = extensionWorkerController.hasEventListenerControllerIdentifier(eventListenerControllerIdentifier);
    if (!hasEventListenerControllerIdentifier) return false;

    //Then to make sure we check eventTargets internal Map
    return this.#eventTarget.hasListener(eventListenerControllerIdentifier);
  }

  async hasEventER(event: eventIdentifier, endpointRightIdentifier?: endpointRightIdentifier): Promise<boolean> {
    const extensionWorkerController = this.getExtensionWorkerControllerOverEndpointIdentifier(endpointRightIdentifier);
    if (extensionWorkerController === null) return false;

    return this.#eventTarget.hasEvent(event);
  }

  async getEventsER(endpointRightIdentifier?: endpointRightIdentifier): Promise<eventIdentifier[] | null> {
    const extensionWorkerController = this.getExtensionWorkerControllerOverEndpointIdentifier(endpointRightIdentifier);
    if (extensionWorkerController === null) return null;

    return this.#eventTarget.getEvents();
  }

  hasUI(uiIdentifier: uiIdentifier): boolean {
    return this.#uiControllers.has(uiIdentifier);
  }

  getUIController(uiIdentifier: uiIdentifier): UIController | null {
    const uiController = this.#uiControllers.get(uiIdentifier);
    if (uiController === undefined) return null;
    return uiController;
  }

  getExtensionWorkerController(extensionWorkerControllerIdentifier: extensionWorkerControllerIdentifier): ExtensionWorkerController | null {
    const extensionWorkerController = this.#extensionWorkerControllers.get(extensionWorkerControllerIdentifier);
    if (extensionWorkerController === undefined) return null;
    return extensionWorkerController;
  }

  getExtensionWorkerControllerOverEndpointIdentifier(endpointRightIdentifier?: endpointRightIdentifier): ExtensionWorkerController | null {
    //There should be an endpointRightIdentifier
    if (endpointRightIdentifier === undefined) return null;

    //Get the endpoint from our Map
    const endpoint = this.#extensionWorkerEndpoints.get(endpointRightIdentifier);
    //Check if it exists and check if the extensionWorkerControllerIdentifier exists
    if (endpoint === undefined || endpoint.extensionWorkerControllerIdentifier === undefined) return null;

    //Get the extensionWorkerController
    const extensionWorkerController = this.getExtensionWorkerController(endpoint.extensionWorkerControllerIdentifier);
    return extensionWorkerController;
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
