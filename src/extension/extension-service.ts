import * as Comlink from "comlink";
import { sendExposed, awaitExposed } from "./comlink-helper";
import * as ExtensionHost from "./extension-host";
import { acquireSDK } from "../sdk";
import { ASDK } from "../sdk/abstracts/sdk";
import { NSExtensionService, endpointRightIdentifier, eventControllerIdentifier, extensionHostControllerIdentifier, iFrameControllerIdentifier, iFrameLocation, spaceIdentifier, spaceZoneLocation, spaceZones, zoneIdentifier } from "./types";
import { SpaceController } from "./controller/space-controller";
import { ExtensionHostController } from "./controller/extension-host-controller";
import { IFrameController } from "./controller/iframe-controller";
import { EventController } from "./controller/event-controller";


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

  addEventListener(iFrameControllerIdentifier: iFrameControllerIdentifier, listener: ((data: any) => any) & Comlink.ProxyMarked): eventControllerIdentifier | null {
    return this.#extensionService.addEventListener(iFrameControllerIdentifier, listener, this.#identifier);
  }

  removeEventListener(iFrameControllerIdentifier: iFrameControllerIdentifier, eventControllerIdentifier: eventControllerIdentifier): boolean {
    return this.#extensionService.removeEventListener(iFrameControllerIdentifier, eventControllerIdentifier, this.#identifier);
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
  #endpointLeft: EndpointLeft;

  constructor() {
    this.#extensionServiceEndpoints = new Map<endpointRightIdentifier, EndpointRight>();
    this.#extensionHostControllers = new Map<extensionHostControllerIdentifier, ExtensionHostController>();
    this.#spaceControllers = new Map<spaceIdentifier, SpaceController>();

    this.#endpointLeft = new EndpointLeft(this as ExtensionService);

    this.#sdk = acquireSDK();
  }

  get endpointLeft() {
    return this.#endpointLeft;
  }

  registerIFrame(ui: File, spaceZoneLocation: spaceZoneLocation, endpointRightIdentifier?: endpointRightIdentifier): iFrameControllerIdentifier | null {
    //There may be some kind of restriction to certain spaces


    //There should be an endpointRightIdentifier
    if (endpointRightIdentifier === undefined) return null;

    //Extract the space and zone identifier
    const [spaceIdentifier, zoneIdentifier] = spaceZoneLocation;
    //Get the spaceController
    const spaceController = this.#spaceControllers.get(spaceIdentifier);

    //Check if the space was registered and if it was not return null
    if (spaceController === undefined) return null;

    //Get the Set with the iFrameLocations for the zone
    const iFrameLocations = spaceController.zoneSet.get(zoneIdentifier);
    //Check if there is a Set for that zone (which there should be if that zone was registered) and if there is none return null
    if (iFrameLocations === undefined) return null;

    //Get the endpoint
    const endpoint = this.#extensionServiceEndpoints.get(endpointRightIdentifier);

    //Check if it exists and if there is an extensionHostControllerIdentifier
    if (endpoint === undefined || endpoint.extensionHostControllerIdentifier === undefined) return null;

    //Get the extensionHostController
    const extensionHostController = this.#extensionHostControllers.get(endpoint.extensionHostControllerIdentifier);
    //Check if it exists and if not return null
    if (extensionHostController === undefined) return null;

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
    const iFrameLocation: iFrameLocation = [extensionHostController.identifier, iFrameController.identifier];
    //Add the iFrameLocation to our zoneSet
    iFrameLocations.add(iFrameLocation);

    //Add the iFrameController to our iFrameControllers Map
    extensionHostController.iFrameControllers.set(iFrameController.identifier, iFrameController);
    //Return the iFrameController identifier
    return iFrameController.identifier;
  }

  removeIFrame(iFrameControllerIdentifier: iFrameControllerIdentifier, endpointRightIdentifier?: endpointRightIdentifier): boolean {
    if (endpointRightIdentifier === undefined) return false;

    const endpoint = this.#extensionServiceEndpoints.get(endpointRightIdentifier);

    if (endpoint === undefined || endpoint.extensionHostControllerIdentifier === undefined) return false;

    const extensionHostController = this.#extensionHostControllers.get(endpoint.extensionHostControllerIdentifier);
    if (extensionHostController === undefined) return false;

    const iFrameController = extensionHostController.iFrameControllers.get(iFrameControllerIdentifier);
    if (iFrameController === undefined) return false;

    const iFrame = iFrameController.iFrame;


    //Up until here it was just getting all the references we need for cleaning up



    //Here we remove all the eventListeners that were connected to the iFrame
    for (const [_, eventController] of iFrameController.eventControllers) {
      eventController.abortController.abort();
    }

    //If the iFrame has a parent (that means it is connected to the DOM)
    //we remove it
    if (iFrame.parentNode !== null)
      iFrame.parentNode.removeChild(iFrame);


    //Get the URL we assigned to our iFrame as its src
    const uiURL = iFrame.src;
    //Remove the URL as it is not needed anymore
    URL.revokeObjectURL(uiURL);


    const spaceZoneLocation = iFrameController.spaceZoneLocation;
    const iFrameLocation: iFrameLocation = [extensionHostController.identifier, iFrameController.identifier];
    //Now we remove the references in our spaceController
    //We do not really care about the return so we ignore it
    this.#removeSpaceControllerEntry(spaceZoneLocation, iFrameLocation);
    //At the end we remove our iFrameController from our iFrameControllers Map
    return extensionHostController.iFrameControllers.delete(iFrameController.identifier);
  }

  removeIFrames(endpointRightIdentifier?: endpointRightIdentifier): boolean {
    if (endpointRightIdentifier === undefined) return false;
    const endpoint = this.#extensionServiceEndpoints.get(endpointRightIdentifier);

    if (endpoint === undefined || endpoint.extensionHostControllerIdentifier === undefined) return false;

    const extensionHostController = this.#extensionHostControllers.get(endpoint.extensionHostControllerIdentifier);
    if (extensionHostController === undefined) return false;

    return this.#removeIFrames(extensionHostController);
  }

  #removeIFrames(extensionHostController: ExtensionHostController): boolean {
    for (const [_, iFrameController] of extensionHostController.iFrameControllers) {
      const iFrame = iFrameController.iFrame;

      for (const [_, eventController] of iFrameController.eventControllers) {
        //Remove the reigstered events to the current IFrame
        eventController.abortController.abort();
      }
      //Remove the IFrame itself if it is appended to the DOM
      if (iFrame.parentNode !== null)
        iFrame.parentNode.removeChild(iFrame);

      const spaceZoneLocation = iFrameController.spaceZoneLocation;
      const iFrameLocation: iFrameLocation = [extensionHostController.identifier, iFrameController.identifier];
      //Now we remove the references in our spaceController
      //We do not really care about the return so we ignore it
      this.#removeSpaceControllerEntry(spaceZoneLocation, iFrameLocation);
    }
    //Big wipe
    extensionHostController.iFrameControllers.clear();
    return true;
  }

  #removeSpaceControllerEntry(spaceZoneLocation: spaceZoneLocation, iFrameLocation: iFrameLocation): boolean {
    const [space, zone] = spaceZoneLocation;
    const spaceController = this.#spaceControllers.get(space);

    //Check if the space was registered and if it was not return false
    if (spaceController === undefined) return false;

    //Get the Set with the iFrameLocations for the zone
    const iFrameLocations = spaceController.zoneSet.get(zone);
    //Check if there is a Set for that zone (which there should be if that zone was registered)
    //Same story here, if there is no Set for the zone we just continue
    if (iFrameLocations === undefined) return false;

    //And remove the IFrameLoation from our Set
    //If this fails we still continue
    //bacause failing means that the iFrameLocation
    //is not even present so we should not really exit
    return iFrameLocations.delete(iFrameLocation);
  }

  addEventListener(iFrameControllerIdentifier: iFrameControllerIdentifier, listener: ((data: any) => any) & Comlink.ProxyMarked, endpointRightIdentifier?: endpointRightIdentifier): eventControllerIdentifier | null {
    if (endpointRightIdentifier === undefined) return null;

    const endpoint = this.#extensionServiceEndpoints.get(endpointRightIdentifier);

    if (endpoint === undefined || endpoint.extensionHostControllerIdentifier === undefined) return null;

    const extensionHostController = this.#extensionHostControllers.get(endpoint.extensionHostControllerIdentifier);
    if (extensionHostController === undefined) return null;

    const iFrameController = extensionHostController.iFrameControllers.get(iFrameControllerIdentifier);
    if (iFrameController === undefined) return null;

    const iFrame = iFrameController.iFrame;
    if (iFrame) {
      const abortController = new AbortController();
      window.addEventListener("message", (ev) => {
        if (ev.source === iFrame.contentWindow) {
          //Instead of just returning the ev.data
          //this could be changed to Comlink.transferHandlers
          //which would allow us to return more data in
          //a more structured way
          listener(ev.data);
        }
      }, { signal: abortController.signal });
      const eventController = new EventController(abortController);

      //Add the eventController to our IFrame specific controller map
      iFrameController.eventControllers.set(eventController.identifier, eventController);
      //Return the iFrame controller 
      return eventController.identifier;
    }
    return null;
  }

  removeEventListener(iFrameControllerIdentifier: iFrameControllerIdentifier, eventControllerIdentifier: eventControllerIdentifier, endpointRightIdentifier?: endpointRightIdentifier): boolean {
    if (endpointRightIdentifier === undefined) return false;

    const endpoint = this.#extensionServiceEndpoints.get(endpointRightIdentifier);

    if (endpoint === undefined || endpoint.extensionHostControllerIdentifier === undefined) return false;

    const extensionHostController = this.#extensionHostControllers.get(endpoint.extensionHostControllerIdentifier);
    if (extensionHostController === undefined) return false;

    const iFrameController = extensionHostController.iFrameControllers.get(iFrameControllerIdentifier);
    if (iFrameController === undefined || !iFrameController.eventControllers.has(eventControllerIdentifier)) return false;

    iFrameController.eventControllers.get(eventControllerIdentifier)!.abortController.abort();
    return iFrameController.eventControllers.delete(eventControllerIdentifier);
  }

  postMessage(iFrameControllerIdentifier: iFrameControllerIdentifier, message: any, endpointRightIdentifier?: endpointRightIdentifier): boolean {
    if (endpointRightIdentifier === undefined) return false;

    const endpoint = this.#extensionServiceEndpoints.get(endpointRightIdentifier);

    if (endpoint === undefined || endpoint.extensionHostControllerIdentifier === undefined) return false;

    const extensionHostController = this.#extensionHostControllers.get(endpoint.extensionHostControllerIdentifier);
    if (extensionHostController === undefined) return false;

    const iFrameController = extensionHostController.iFrameControllers.get(iFrameControllerIdentifier);
    if (iFrameController === undefined) return false;

    const iFrame = iFrameController.iFrame;
    if (iFrame && iFrame.contentWindow && iFrame.contentDocument && iFrame.contentDocument.readyState == "complete") {
      iFrame.contentWindow.postMessage(message);
      return true;
    }
    return false;
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
      //Creating an Array to hold all the zones for our space. This will later be pushing to the spaceZones Array
      let zones: zoneIdentifier[] = new Array<zoneIdentifier>(spaceController.zoneSet.size);
      for (const [zone, _] of spaceController.zoneSet) {
        //Iterating over all the zones and pushing them to our zones Array
        zones.push(zone);
      }
      //Pushing the current space with all its zone to our spaces Array
      spaces.push([space, zones]);
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

    const [space, zone] = spaceZoneLocation;

    const spaceController = this.#spaceControllers.get(space);
    if (spaceController === undefined) return false;

    return spaceController.zoneSet.has(zone);
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
    const controller = new ExtensionHostController(worker, extensionHostEndpoint);



    //Saving cross identifier references
    controller.endpointRightIdentifier = endpointRight.identifier;
    endpointRight.extensionHostControllerIdentifier = controller.identifier;

    this.#extensionHostControllers.set(controller.identifier, controller);
    this.#extensionServiceEndpoints.set(endpointRight.identifier, endpointRight);

    //Automatically resolve all the extensions after ExtensionHost creation
    await extensionHostEndpoint.resolveExtensions();

    return controller.identifier;
  }

  unloadExtensionHost(extensionHostControllerIdentifier: extensionHostControllerIdentifier): boolean {
    //Grab the controller from our map
    const controller = this.#extensionHostControllers.get(extensionHostControllerIdentifier);
    if (controller === undefined || controller.endpointRightIdentifier === undefined) return false;

    //Remove all created IFrames and with it all the event listeners
    this.#removeIFrames(controller);

    //Terminate the worker and set our reference to null for the GC
    controller.worker!.terminate();
    controller.worker = null;

    //Remove the endpoint from our endpoint registry
    if (!this.#extensionServiceEndpoints.delete(controller.endpointRightIdentifier)) return false;


    //Remove the controller from our controllers registry
    if (!this.#extensionHostControllers.delete(controller.identifier)) return false;
    return true;
  }

  async loadExtension(extensionIdentifier: string, extensionHostControllerIdentifier: extensionHostControllerIdentifier): Promise<boolean> {
    const controller = this.#extensionHostControllers.get(extensionHostControllerIdentifier);
    if (controller === undefined) return false;
    return controller.extensionHostEndpoint.loadExtension(extensionIdentifier);

  }

  async unloadExtension(extensionIdentifier: string, extensionHostControllerIdentifier: extensionHostControllerIdentifier): Promise<boolean> {
    const controller = this.#extensionHostControllers.get(extensionHostControllerIdentifier);
    if (controller === undefined) return false;

    return controller.extensionHostEndpoint.unloadExtension(extensionIdentifier);
  }

  registerSpace(spaceIdentifier: spaceIdentifier, zoneIdentifiers?: [zoneIdentifier]): boolean {

    //If the space already exists, then return false
    if (this.#spaceControllers.has(spaceIdentifier)) return false;

    //Create a controller
    const controller = new SpaceController(spaceIdentifier);
    //Check if there are any zones
    if (zoneIdentifiers !== undefined) {
      //Iterate over all the provided zones
      for (const zone of zoneIdentifiers) {
        //Check if a zone with that name is already defined
        if (!controller.zoneSet.has(zone)) {
          //If there is none add one
          controller.zoneSet.set(zone, new Set<iFrameLocation>());
        }
      }
    }
    //Add the space to our Map
    this.#spaceControllers.set(controller.identifier, controller);
    //We cooking
    return true;
  }

  registerZone(spaceIdentifier: spaceIdentifier, zoneIdentifier: zoneIdentifier): boolean {
    const controller = this.#spaceControllers.get(spaceIdentifier);
    //If the space does not exist, then return false
    if (controller === undefined) return false;

    //Check if the zone already exists. If it does, then return false
    if (controller.zoneSet.has(zoneIdentifier)) return false;

    controller.zoneSet.set(zoneIdentifier, new Set<iFrameLocation>());
    return true;
  }

  //This function loads a space.
  //If the space is changed, unloadSpace has to be called
  loadSpace(spaceIdentifier: spaceIdentifier): boolean {
    //Get the right spaceController
    const spaceController = this.#spaceControllers.get(spaceIdentifier);
    //Check if the spaceController exists and if not return false
    if (spaceController === undefined) return false;

    //Iterate over all the zones of the space
    for (const [zoneIdentifier, iFrameLocations] of spaceController.zoneSet) {
      //Grab the html element that represent the zone based on the zoneIdentifier
      //The developers have to make sure that the zone really exists
      const zone = document.getElementById(zoneIdentifier);
      //If it does not exist continue with the next zone
      if (zone === null) continue;
      //Iterate over all the iFrameLocations
      for (const [extensionHostControllerIdentifier, iFrameControllerIdentifier] of iFrameLocations) {
        //Grab the extensionHostController
        const extensionHostController = this.#extensionHostControllers.get(extensionHostControllerIdentifier);
        //Check if it exists and if it does not exist, then continue with the next iFrameLocation
        if (extensionHostController === undefined) continue;

        //Grab the iFrameController
        const iFrameController = extensionHostController.iFrameControllers.get(iFrameControllerIdentifier);
        //Check if it exists and if it does not exist, then continue with the next iFrameLocation
        if (iFrameController === undefined) continue;

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
    const spaceController = this.#spaceControllers.get(spaceIdentifier);
    //Check if the spaceController exists and if not return false
    if (spaceController === undefined) return false;

    //Iterate over all the zones of the space
    for (const [zoneIdentifier, iFrameLocations] of spaceController.zoneSet) {
      //Grab the html element that represent the zone based on the zoneIdentifier
      //The developers have to make sure that the zone really exists
      const zone = document.getElementById(zoneIdentifier);
      //If it does not exist continue with the next zone
      if (zone === null) continue;
      //Iterate over all the iFrameLocations
      for (const [extensionHostControllerIdentifier, iFrameControllerIdentifier] of iFrameLocations) {
        //Grab the extensionHostController
        const extensionHostController = this.#extensionHostControllers.get(extensionHostControllerIdentifier);
        //Check if it exists and if it does not exist, then continue with the next iFrameLocation
        if (extensionHostController === undefined) continue;

        //Grab the iFrameController
        const iFrameController = extensionHostController.iFrameControllers.get(iFrameControllerIdentifier);
        //Check if it exists and if it does not exist, then continue with the next iFrameLocation
        if (iFrameController === undefined) continue;

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
    const spaceController = this.#spaceControllers.get(spaceIdentifier);
    //Check if the spaceController exists and if not return false
    if (spaceController === undefined) return false;

    //Iterate over all the zones of the space
    for (const [zoneIdentifier, iFrameLocations] of spaceController.zoneSet) {
      //Grab the html element that represent the zone based on the zoneIdentifier
      //The developers have to make sure that the zone really exists
      const zone = document.getElementById(zoneIdentifier);
      //If it does not exist continue with the next zone
      if (zone === null) continue;
      //Iterate over all the iFrameLocations
      for (const [extensionHostControllerIdentifier, iFrameControllerIdentifier] of iFrameLocations) {
        //Grab the extensionHostController
        const extensionHostController = this.#extensionHostControllers.get(extensionHostControllerIdentifier);
        //Check if it exists and if it does not exist, then continue with the next iFrameLocation
        if (extensionHostController === undefined) continue;

        //Grab the iFrameController
        const iFrameController = extensionHostController.iFrameControllers.get(iFrameControllerIdentifier);
        //Check if it exists and if it does not exist, then continue with the next iFrameLocation
        if (iFrameController === undefined) continue;


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
