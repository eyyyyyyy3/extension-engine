import * as Comlink from "comlink";
import { sendExposed, awaitExposed } from "./comlink-helper";
import * as ExtensionHost from "./extension-host";
import { acquireSDK } from "../sdk";
import { ASDK } from "../sdk/abstracts/sdk";
import { NSExtensionService, endpointRightIdentifier, eventListenerControllerIdentifier, extensionHostControllerIdentifier, iFrameControllerIdentifier, spaceIdentifier, spaceZoneLocation, spaceZones, zoneIdentifier } from "./types";
import { SpaceController } from "./controller/space-controller";
import { ExtensionHostController } from "./controller/extension-host-controller";
import { IFrameController } from "./controller/iframe-controller";
import { EventListenerController } from "./controller/event-listener-controller";


//TODO: Rework so that I can move it to the types (maybe even a tuple)
//Currently all the right endpoints are classes. This is because
//they implement the interfaces but deliberately leave out the
//endpointRightIdentifier as the caller doesn't and mustn't provide it
export interface IExposeRight {
  endpoint: EndpointRight & Comlink.ProxyMarked;
  sdk: ASDK & Comlink.ProxyMarked;
}


class EndpointLeft implements NSExtensionService.IEndpointLeft {
  //Because there should only be one single instance of an EndpointLeft,
  //there is no need for any identifier.
  #extensionService: ExtensionService;
  constructor(extensionService: ExtensionService) {
    this.#extensionService = extensionService;
  }

  loadExtensionHost(): Promise<extensionHostControllerIdentifier> {
    return this.#extensionService.loadExtensionHost();
  }

  unloadExtensionHost(extensionHostControllerIdentifier: extensionHostControllerIdentifier): boolean {
    return this.#extensionService.unloadExtensionHost(extensionHostControllerIdentifier);
  }

  loadExtension(extensionIdentifier: string, extensionHostControllerIdentifier: extensionHostControllerIdentifier): Promise<boolean> {
    return this.#extensionService.loadExtension(extensionIdentifier, extensionHostControllerIdentifier);
  }

  unloadExtension(extensionIdentifier: string, extensionHostControllerIdentifier: extensionHostControllerIdentifier): Promise<boolean> {
    return this.#extensionService.unloadExtension(extensionIdentifier, extensionHostControllerIdentifier);

  }

  registerSpace(spaceIdentifier: spaceIdentifier, zoneIdentifiers?: [zoneIdentifier]): boolean {
    return this.#extensionService.registerSpace(spaceIdentifier, zoneIdentifiers);
  }

  registerZone(spaceIdentifier: spaceIdentifier, zoneIdentifier: zoneIdentifier): boolean {
    return this.#extensionService.registerZone(spaceIdentifier, zoneIdentifier);
  }

  loadSpace(spaceIdentifier: spaceIdentifier): boolean {
    return this.#extensionService.loadSpace(spaceIdentifier);
  }

  unloadSpace(spaceIdentifier: spaceIdentifier): boolean {
    return this.#extensionService.unloadSpace(spaceIdentifier);
  }

  updateSpace(spaceIdentifier: spaceIdentifier): boolean {
    return this.#extensionService.updateSpace(spaceIdentifier);
  }

  status(): void {
    this.#extensionService.status();
  }

}

export class EndpointRight implements NSExtensionService.IEndpointRight {
  static #currentIdentifier: endpointRightIdentifier = 0;
  #identifier: endpointRightIdentifier;
  #extensionService: ExtensionService;
  #extensionHostControllerIdentifier: extensionHostControllerIdentifier | undefined;

  constructor(extensionService: ExtensionService) {
    this.#identifier = EndpointRight.#currentIdentifier;
    EndpointRight.#currentIdentifier += 1;
    this.#extensionService = extensionService;
  }

  get identifier() {
    return this.#identifier;
  }

  get extensionHostControllerIdentifier(): extensionHostControllerIdentifier | undefined {
    return this.#extensionHostControllerIdentifier;
  }

  set extensionHostControllerIdentifier(extensionHostControllerIdentifier: extensionHostControllerIdentifier) {
    if (this.#extensionHostControllerIdentifier !== undefined) return;
    this.#extensionHostControllerIdentifier = extensionHostControllerIdentifier;
  }

  registerIFrame(ui: File, spaceZoneLocation: spaceZoneLocation): iFrameControllerIdentifier | null {
    return this.#extensionService.registerIFrame(ui, spaceZoneLocation, this.#identifier);
  }

  removeIFrame(iFrameControllerIdentifier: iFrameControllerIdentifier): boolean {
    return this.#extensionService.removeIFrame(iFrameControllerIdentifier, this.#identifier);
  }

  removeIFrames(): boolean {
    return this.#extensionService.removeIFrames(this.#identifier);
  }

  registerListener(iFrameControllerIdentifier: iFrameControllerIdentifier, listener: ((data: any) => any) & Comlink.ProxyMarked): eventListenerControllerIdentifier | null {
    return this.#extensionService.registerListener(iFrameControllerIdentifier, listener, this.#identifier);
  }

  removeListener(iFrameControllerIdentifier: iFrameControllerIdentifier, eventListenerControllerIdentifier: eventListenerControllerIdentifier): boolean {
    return this.#extensionService.removeListener(iFrameControllerIdentifier, eventListenerControllerIdentifier, this.#identifier);
  }

  postMessage(iFrameControllerIdentifier: iFrameControllerIdentifier, message: any): boolean {
    return this.#extensionService.postMessage(iFrameControllerIdentifier, message, this.#identifier);
  }

  getSpaces(): spaceZones[] | null {
    return this.#extensionService.getSpaces(this.#identifier);
  }

  hasSpaceZone(spaceZoneLocation: spaceZoneLocation): boolean {
    return this.#extensionService.hasSpaceZone(spaceZoneLocation, this.#identifier);
  }
}

export class ExtensionService implements NSExtensionService.IEndpointLeft, NSExtensionService.IEndpointRight {

  //Currently because of https://github.com/tauri-apps/tauri/issues/3308#issuecomment-1025132141
  //the sdk has to be created within the context of the main thread. Because of this
  //limitation, we are creating an instance of the sdk in the constructor
  //(as ExtensionService has to be initiated inside of the main thread) and passing
  //it to the ExtensionHost as a Comlink.ProxyMarked
  #sdk: ASDK;
  #extensionServiceEndpoints: Map<endpointRightIdentifier, EndpointRight>;
  #extensionHostControllers: Map<extensionHostControllerIdentifier, ExtensionHostController>;
  #spaceControllers: Map<spaceIdentifier, SpaceController>;
  #iFrameControllers: Map<iFrameControllerIdentifier, IFrameController>;
  #endpointLeft: EndpointLeft;

  constructor() {
    this.#extensionServiceEndpoints = new Map<endpointRightIdentifier, EndpointRight>();
    this.#extensionHostControllers = new Map<extensionHostControllerIdentifier, ExtensionHostController>();
    this.#spaceControllers = new Map<spaceIdentifier, SpaceController>();
    this.#iFrameControllers = new Map<iFrameControllerIdentifier, IFrameController>();

    this.#endpointLeft = new EndpointLeft(this as ExtensionService);

    this.#sdk = acquireSDK();
  }

  get endpointLeft() {
    return this.#endpointLeft;
  }

  registerIFrame(ui: File, spaceZoneLocation: spaceZoneLocation, endpointRightIdentifier?: endpointRightIdentifier): iFrameControllerIdentifier | null {
    // There may be some kind of restriction to certain spaces
    if (endpointRightIdentifier === undefined) return null;

    //Extract the space and zone identifier
    const [spaceIdentifier, zoneIdentifier] = spaceZoneLocation;
    //Get the spaceController
    const spaceController = this.getSpaceController(spaceIdentifier);

    //Check if the space was registered and if it was not return null
    if (spaceController === null) return null;

    //Check if there is a Set for that zone (which there should be if that zone was registered) and if there is none return null
    if (!spaceController.hasZone(zoneIdentifier)) return null;

    //Get the endpoint
    const endpoint = this.#extensionServiceEndpoints.get(endpointRightIdentifier);

    //Check if it exists and if there is an extensionHostControllerIdentifier
    if (endpoint === undefined || endpoint.extensionHostControllerIdentifier === undefined) return null;

    //Get the extensionHostController
    const extensionHostController = this.getExtensionHostController(endpoint.extensionHostControllerIdentifier);
    //Check if it exists and if not return null
    if (extensionHostController === null) return null;


    //Create an iFrame
    const iFrame = document.createElement("iframe");
    //Assign it to an IFrameController and set the spaceZoneLocation for the iFrame
    const iFrameController = new IFrameController(iFrame, spaceZoneLocation);
    iFrame.id = iFrameController.identifier;

    //TODO: Sandbox
    //iFrame.sandbox

    //Create a URL from the ui for our iFrame.src
    const uiURL = URL.createObjectURL(ui);
    //Assign it to the iFrame.src
    iFrame.src = uiURL;

    //Create an iFrameLocation for the zoneSet

    //Add the iFrameController to our iFrameControllers Map
    this.#iFrameControllers.set(iFrameController.identifier, iFrameController);


    //Register the iFrameControllerIdentifier to our zones
    let hasIFrameControllerIdentifierRegistered = extensionHostController.registerIFrameControllerIdentifier(iFrameController.identifier);
    if (!hasIFrameControllerIdentifierRegistered) return null;

    //Register the iFrameControllerIdentifier to our zones
    hasIFrameControllerIdentifierRegistered = spaceController.registerIFrameControllerIdentifier(zoneIdentifier, iFrameController.identifier);
    if (!hasIFrameControllerIdentifierRegistered) return null;

    //Return the iFrameController identifier
    return iFrameController.identifier;
  }

  removeIFrame(iFrameControllerIdentifier: iFrameControllerIdentifier, endpointRightIdentifier?: endpointRightIdentifier): boolean {
    if (endpointRightIdentifier === undefined) return false;

    const endpoint = this.#extensionServiceEndpoints.get(endpointRightIdentifier);

    if (endpoint === undefined || endpoint.extensionHostControllerIdentifier === undefined) return false;

    const extensionHostController = this.getExtensionHostController(endpoint.extensionHostControllerIdentifier);
    if (extensionHostController === null) return false;

    const iFrameController = this.getIFrameController(iFrameControllerIdentifier);
    if (iFrameController === null) return false;

    const [space, zone] = iFrameController.spaceZoneLocation;
    const spaceController = this.getSpaceController(space);
    if (spaceController === null) return false;



    let wasIFrameControllerIdentifierRemoved = spaceController.removeIFrameControllerIdentifier(zone, iFrameController.identifier);
    if (!wasIFrameControllerIdentifierRemoved) return false;

    wasIFrameControllerIdentifierRemoved = extensionHostController.removeIFrameControllerIdentifier(iFrameController.identifier);
    if (!wasIFrameControllerIdentifierRemoved) return false;


    iFrameController.removeListeners();

    const iFrame = iFrameController.iFrame;

    //If the iFrame has a parent (that means it is connected to the DOM)
    //we remove it
    if (iFrame.parentNode !== null)
      iFrame.parentNode.removeChild(iFrame);

    //Get the URL we assigned to our iFrame as its src
    const uiURL = iFrame.src;
    //Remove the URL as it is not needed anymore
    URL.revokeObjectURL(uiURL);

    //At the end we remove our iFrameController from our iFrameControllers Map
    return this.#iFrameControllers.delete(iFrameControllerIdentifier);
  }

  removeIFrames(endpointRightIdentifier?: endpointRightIdentifier): boolean {
    if (endpointRightIdentifier === undefined) return false;
    const endpoint = this.#extensionServiceEndpoints.get(endpointRightIdentifier);

    if (endpoint === undefined || endpoint.extensionHostControllerIdentifier === undefined) return false;

    const extensionHostController = this.getExtensionHostController(endpoint.extensionHostControllerIdentifier);
    if (extensionHostController === null) return false;
    return this.#removeIFrames(extensionHostController);
  }

  #removeIFrames(extensionHostController: ExtensionHostController): boolean {
    for (const [_, iFrameController] of this.#iFrameControllers) {

      const [space, zone] = iFrameController.spaceZoneLocation;

      const spaceController = this.getSpaceController(space);
      if (spaceController === null) return false;


      let wasIFrameLocationRemoved = spaceController.removeIFrameControllerIdentifier(zone, iFrameController.identifier);
      if (!wasIFrameLocationRemoved) return false;

      wasIFrameLocationRemoved = extensionHostController.removeIFrameControllerIdentifier(iFrameController.identifier);
      if (!wasIFrameLocationRemoved) return false;

      iFrameController.removeListeners();

      const iFrame = iFrameController.iFrame;

      //If the iFrame has a parent (that means it is connected to the DOM)
      //we remove it
      if (iFrame.parentNode !== null)
        iFrame.parentNode.removeChild(iFrame);

      //Get the URL we assigned to our iFrame as its src
      const uiURL = iFrame.src;
      //Remove the URL as it is not needed anymore
      URL.revokeObjectURL(uiURL);

    }
    //Big wipe
    this.#iFrameControllers.clear();
    return true;
  }


  registerListener(iFrameControllerIdentifier: iFrameControllerIdentifier, listener: ((data: any) => any) & Comlink.ProxyMarked, endpointRightIdentifier?: endpointRightIdentifier): eventListenerControllerIdentifier | null {
    if (endpointRightIdentifier === undefined) return null;

    const endpoint = this.#extensionServiceEndpoints.get(endpointRightIdentifier);

    if (endpoint === undefined || endpoint.extensionHostControllerIdentifier === undefined) return null;

    const extensionHostController = this.getExtensionHostController(endpoint.extensionHostControllerIdentifier);
    if (extensionHostController === null) return null;

    const iFrameController = this.getIFrameController(iFrameControllerIdentifier);
    if (iFrameController === null) return null;

    return iFrameController.registerListener(listener);
  }

  removeListener(iFrameControllerIdentifier: iFrameControllerIdentifier, eventListenerControllerIdentifier: eventListenerControllerIdentifier, endpointRightIdentifier?: endpointRightIdentifier): boolean {
    if (endpointRightIdentifier === undefined) return false;

    const endpoint = this.#extensionServiceEndpoints.get(endpointRightIdentifier);

    if (endpoint === undefined || endpoint.extensionHostControllerIdentifier === undefined) return false;

    const extensionHostController = this.getExtensionHostController(endpoint.extensionHostControllerIdentifier);
    if (extensionHostController === null) return false;

    const iFrameController = this.getIFrameController(iFrameControllerIdentifier);
    if (iFrameController === null || !iFrameController.eventListenerControllers.has(eventListenerControllerIdentifier)) return false;

    return iFrameController.removeListener(eventListenerControllerIdentifier);
  }

  postMessage(iFrameControllerIdentifier: iFrameControllerIdentifier, message: any, endpointRightIdentifier?: endpointRightIdentifier): boolean {
    if (endpointRightIdentifier === undefined) return false;

    const endpoint = this.#extensionServiceEndpoints.get(endpointRightIdentifier);

    if (endpoint === undefined || endpoint.extensionHostControllerIdentifier === undefined) return false;

    const extensionHostController = this.getExtensionHostController(endpoint.extensionHostControllerIdentifier);
    if (extensionHostController === null) return false;

    const iFrameController = this.getIFrameController(iFrameControllerIdentifier);
    if (iFrameController === null) return false;

    return iFrameController.postMessage(message);
  }

  getSpaces(endpointRightIdentifier?: endpointRightIdentifier): spaceZones[] | null {
    //We take the endpointRightIdentifier as this may be used later on to add 
    //restrictions
    if (endpointRightIdentifier === undefined) return null;

    const endpoint = this.#extensionServiceEndpoints.get(endpointRightIdentifier);

    if (endpoint === undefined || endpoint.extensionHostControllerIdentifier === undefined) return null;

    if (!this.#extensionHostControllers.has(endpoint.extensionHostControllerIdentifier)) return null;

    //Creating an Array to hold all our spaces with their individual zones
    let spaces: spaceZones[] = new Array<spaceZones>(this.#spaceControllers.size);

    //Iterating over all the spaceControllers and grabbing the spaceIdentifier
    for (const [space, spaceController] of this.#spaceControllers) {
      //Pushing the current space with all its zone to our spaces Array
      spaces.push([space, spaceController.getZones()]);
    }

    //Returning our spaces Array
    return spaces;
  }

  hasSpaceZone(spaceZoneLocation: spaceZoneLocation, endpointRightIdentifier?: endpointRightIdentifier): boolean {
    //We take the endpointRightIdentifier as this may be used later on to add 
    //restrictions
    if (endpointRightIdentifier === undefined) return false;

    const endpoint = this.#extensionServiceEndpoints.get(endpointRightIdentifier);

    if (endpoint === undefined || endpoint.extensionHostControllerIdentifier === undefined) return false;

    if (!this.#extensionHostControllers.has(endpoint.extensionHostControllerIdentifier)) return false;

    const [spaceIdentifier, zoneIdentifier] = spaceZoneLocation;

    const spaceController = this.getSpaceController(spaceIdentifier);
    if (spaceController === null) return false;

    return spaceController.hasZone(zoneIdentifier);
  }

  getIFrameController(iFrameControllerIdentifier: iFrameControllerIdentifier): IFrameController | null {
    const iFrameController = this.#iFrameControllers.get(iFrameControllerIdentifier);
    if (iFrameController === undefined) return null;
    return iFrameController;
  }

  getExtensionHostController(extensionHostControllerIdentifier: extensionHostControllerIdentifier): ExtensionHostController | null {
    const extensionHostController = this.#extensionHostControllers.get(extensionHostControllerIdentifier);
    if (extensionHostController === undefined) return null;
    return extensionHostController;
  }

  getSpaceController(spaceIdentifier: spaceIdentifier): SpaceController | null {
    const spaceController = this.#spaceControllers.get(spaceIdentifier);
    if (spaceController === undefined) return null;
    return spaceController;

  }

  async loadExtensionHost(): Promise<extensionHostControllerIdentifier> {

    //This might fails too cause of the path
    //Create an extension-host
    const worker = new Worker(new URL("./extension-host.ts", import.meta.url), { type: "module" });

    //Now we create the endpoint and sdk proxy which we will expose to the extension-host.
    const endpointRight = new EndpointRight(this as ExtensionService);

    const exposeRight: IExposeRight = {
      endpoint: Comlink.proxy(endpointRight),
      sdk: Comlink.proxy(this.#sdk),
    };

    Comlink.expose(exposeRight, worker);
    sendExposed(worker);

    //Await till it has done its thing and exposed the endpoint. After that wrap the endpoint
    await awaitExposed(worker);

    const extensionHostEndpoint = Comlink.wrap<ExtensionHost.EndpointLeft>(worker);
    //Create a controller to save all the relevant extension-host information
    const extensionHostController = new ExtensionHostController(worker, extensionHostEndpoint);

    //Saving cross identifier references
    //extensionHostController.endpointRightIdentifier safes the reference to the endpoint that will be exposed to the extension-host
    extensionHostController.endpointRightIdentifier = endpointRight.identifier;
    //endpointRight.extensionHostControllerIdentifier safes the reference to the extensionHostController which is responsible for managing the endpoint
    endpointRight.extensionHostControllerIdentifier = extensionHostController.identifier;

    this.#extensionHostControllers.set(extensionHostController.identifier, extensionHostController);
    this.#extensionServiceEndpoints.set(endpointRight.identifier, endpointRight);

    //Automatically resolve all the extensions after ExtensionHost creation
    await extensionHostController.resolveExtensions();

    return extensionHostController.identifier;
  }

  unloadExtensionHost(extensionHostControllerIdentifier: extensionHostControllerIdentifier): boolean {
    //Grab the controller from our map
    const extensionHostController = this.getExtensionHostController(extensionHostControllerIdentifier);
    if (extensionHostController === null || extensionHostController.endpointRightIdentifier === undefined) return false;

    //Remove all created IFrames and with it all the event listeners
    this.#removeIFrames(extensionHostController);

    //Terminate the worker and set our reference to null for the GC
    extensionHostController.worker!.terminate();
    extensionHostController.worker = null;

    //Remove the endpoint from our endpoint registry
    if (!this.#extensionServiceEndpoints.delete(extensionHostController.endpointRightIdentifier)) return false;

    //Remove the controller from our controllers registry
    if (!this.#extensionHostControllers.delete(extensionHostController.identifier)) return false;
    return true;
  }

  async loadExtension(extensionIdentifier: string, extensionHostControllerIdentifier: extensionHostControllerIdentifier): Promise<boolean> {
    const extensionHostController = this.getExtensionHostController(extensionHostControllerIdentifier);
    if (extensionHostController === null) return false;
    return extensionHostController.loadExtension(extensionIdentifier);

  }

  async unloadExtension(extensionIdentifier: string, extensionHostControllerIdentifier: extensionHostControllerIdentifier): Promise<boolean> {
    const extensionHostController = this.getExtensionHostController(extensionHostControllerIdentifier);
    if (extensionHostController === null) return false;

    return extensionHostController.unloadExtension(extensionIdentifier);
  }

  registerSpace(spaceIdentifier: spaceIdentifier, zoneIdentifiers?: [zoneIdentifier]): boolean {

    //If the space already exists, then return false
    if (this.#spaceControllers.has(spaceIdentifier)) return false;

    //Create a controller
    const spaceController = new SpaceController(spaceIdentifier);
    //Check if there are any zones
    if (zoneIdentifiers !== undefined) {
      spaceController.registerZones(zoneIdentifiers);
    }
    //Add the space to our Map
    this.#spaceControllers.set(spaceController.identifier, spaceController);
    //We cooking
    return true;
  }

  registerZone(spaceIdentifier: spaceIdentifier, zoneIdentifier: zoneIdentifier): boolean {
    const spaceController = this.getSpaceController(spaceIdentifier);
    //If the space does not exist, then return false
    if (spaceController === null) return false;
    return spaceController.registerZone(zoneIdentifier);
  }

  //This function loads a space.
  //If the space is changed, unloadSpace has to be called
  loadSpace(spaceIdentifier: spaceIdentifier): boolean {
    //Get the right spaceController
    const spaceController = this.getSpaceController(spaceIdentifier);
    //Check if the spaceController exists and if not return false
    if (spaceController === null) return false;

    //Iterate over all the zones of the space
    for (const [zoneIdentifier, iFrameControllerIdentifiers] of spaceController.zones) {
      //Grab the html element that represent the zone based on the zoneIdentifier
      //The developers have to make sure that the zone really exists
      const zone = document.getElementById(zoneIdentifier);
      //If it does not exist continue with the next zone
      if (zone === null) continue;
      //Iterate over all the iFrameLocations
      for (const iFrameControllerIdentifier of iFrameControllerIdentifiers) {
        //Grab the iFrameController
        const iFrameController = this.getIFrameController(iFrameControllerIdentifier);
        //Check if it exists and if it does not exist, then continue with the next iFrameLocation
        if (iFrameController === null) continue;

        //If it has a parent node we skip appending it
        if (iFrameController.iFrame.parentNode !== null) continue;

        //Try appending the iFrame to the zone
        try {
          zone.append(iFrameController.iFrame);
        } catch (error) {
          console.error(`[EXTENSION-SERVICE] ${error}`);
          //We do not want to return false, as there are other iFrameLocations and other zones to follow
          continue;
        }
      }

    }
    return true;
  }

  //This function unloads the current space and it serves
  //as a cleanup function. It has to be called if the space
  //was loaded with loadSpace and is now being changed to another space
  unloadSpace(spaceIdentifier: spaceIdentifier): boolean {
    //Get the right spaceController
    const spaceController = this.getSpaceController(spaceIdentifier);
    //Check if the spaceController exists and if not return false
    if (spaceController === null) return false;

    //Iterate over all the zones of the space
    for (const [zoneIdentifier, iFrameControllerIdentifiers] of spaceController.zones) {
      //Grab the html element that represent the zone based on the zoneIdentifier
      //The developers have to make sure that the zone really exists
      const zone = document.getElementById(zoneIdentifier);
      //If it does not exist continue with the next zone
      if (zone === null) continue;
      //Iterate over all the iFrameLocations
      for (const iFrameControllerIdentifier of iFrameControllerIdentifiers) {
        //Grab the iFrameController
        const iFrameController = this.getIFrameController(iFrameControllerIdentifier);
        //Check if it exists and if it does not exist, then continue with the next iFrameLocation
        if (iFrameController === null) continue;

        //If it has NO parent node we skip removing it
        if (iFrameController.iFrame.parentNode === null) continue;

        //Try removing the iFrame from its parent (aka its specified zone)
        try {
          iFrameController.iFrame.parentNode.removeChild(iFrameController.iFrame);
        } catch (error) {
          console.error(`[EXTENSION-SERVICE] ${error}`);
          //We do not want to return false, as there are other iFrameLocations and other zones to follow
          continue;
        }
      }

    }
    return true;
  }

  //An alternative to calling load- and unloadSpace.
  //This function lazily removes the parents of an iFrame
  //if that iFrame should be rendered but still has a parent
  updateSpace(spaceIdentifier: spaceIdentifier): boolean {
    //Get the right spaceController
    const spaceController = this.getSpaceController(spaceIdentifier);
    //Check if the spaceController exists and if not return false
    if (spaceController === null) return false;

    //Iterate over all the zones of the space
    for (const [zoneIdentifier, iFrameControllerIdentifiers] of spaceController.zones) {
      //Grab the html element that represent the zone based on the zoneIdentifier
      //The developers have to make sure that the zone really exists
      const zone = document.getElementById(zoneIdentifier);
      //If it does not exist continue with the next zone
      if (zone === null) continue;
      //Iterate over all the iFrameLocations
      for (const iFrameControllerIdentifier of iFrameControllerIdentifiers) {
        //Grab the iFrameController
        const iFrameController = this.getIFrameController(iFrameControllerIdentifier);
        //Check if it exists and if it does not exist, then continue with the next iFrameLocation
        if (iFrameController === null) continue;


        //Try appending the iFrame to the zone
        try {
          //If it has a parent node we remove it
          if (iFrameController.iFrame.parentNode !== null) {
            iFrameController.iFrame.parentNode.removeChild(iFrameController.iFrame);
          }
          //And after that we try appending it to its new parent
          zone.append(iFrameController.iFrame);
        } catch (error) {
          console.error(`[EXTENSION-SERVICE] ${error}`);
          //We do not want to return false, as there are other iFrameLocations and other zones to follow
          continue;
        }
      }

    }
    return true;
  }

  status(): void {
    let numberControllers = this.#extensionHostControllers.size;
    let numberEndpoints = this.#extensionServiceEndpoints.size;
    console.log(`Currently active: ${numberControllers} controller(s) and ${numberEndpoints} endpoint(s).`);
  }
}
