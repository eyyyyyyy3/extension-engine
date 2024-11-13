import * as Comlink from "comlink";
import { extensionHostControllerIdentifier, iFrameControllerIdentifier, endpointRightIdentifier, NSExtensionHost, spaceZoneLocation, eventListenerControllerIdentifier, iFrameLocation, extensionIdentifier, extensionState } from "../types";
import { IFrameController } from "./iframe-controller";

//The ExtensionHostController hold all the relevant information of an extension-host.
//It has references to the actual web worker and all the IFrames that were opened via
//that extension-host and the actual endpoint of the extension-host. The controllers
//are used by both the left and the right ExtensionServiceEndpoints.
export class ExtensionHostController implements NSExtensionHost.IEndpointLeft {
  static #currentIdentifier: extensionHostControllerIdentifier = 0;
  identifier: extensionHostControllerIdentifier;
  iFrameControllers: Map<iFrameControllerIdentifier, IFrameController>;
  worker: Worker | null;
  extensionHostEndpoint: Comlink.Remote<NSExtensionHost.IEndpointLeft>;
  endpointRightIdentifier: endpointRightIdentifier | undefined;

  constructor(worker: Worker, extensionHostEndpoint: Comlink.Remote<NSExtensionHost.IEndpointLeft>) {
    this.identifier = ExtensionHostController.#currentIdentifier;
    this.iFrameControllers = new Map<iFrameControllerIdentifier, IFrameController>;
    ExtensionHostController.#currentIdentifier += 1;
    this.worker = worker;
    this.extensionHostEndpoint = extensionHostEndpoint;
  }

  registerIFrame(ui: File, spaceZoneLocation: spaceZoneLocation): iFrameControllerIdentifier | null {
    //There may be some kind of restriction to certain spaces

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
    this.iFrameControllers.set(iFrameController.identifier, iFrameController);
    //Return the iFrameControllerIdentifie
    return iFrameController.identifier;
  }

  removeIFrame(iFrameControllerIdentifier: iFrameControllerIdentifier): boolean {
    const iFrameController = this.iFrameControllers.get(iFrameControllerIdentifier);
    if (iFrameController === undefined) return false;

    const iFrame = iFrameController.iFrame;

    for (const [_, eventListenerController] of iFrameController.eventListenerControllers) {
      eventListenerController.abort();
    }

    //If the iFrame has a parent (that means it is connected to the DOM)
    //we remove it
    if (iFrame.parentNode !== null)
      iFrame.parentNode.removeChild(iFrame);


    //Get the URL we assigned to our iFrame as its src
    const uiURL = iFrame.src;
    //Remove the URL as it is not needed anymore
    URL.revokeObjectURL(uiURL);


    //At the end we remove our iFrameController from our iFrameControllers Map
    return this.iFrameControllers.delete(iFrameControllerIdentifier);
  }

  getIFrameController(iFrameControllerIdentifier: iFrameControllerIdentifier): IFrameController | null {
    const iFrameController = this.iFrameControllers.get(iFrameControllerIdentifier);
    if (iFrameController === undefined) return null;
    return iFrameController;
  }

  getIFrameControllers(): Map<iFrameControllerIdentifier, IFrameController> {
    return this.iFrameControllers;
  }

  addEventListener(iFrameControllerIdentifier: iFrameControllerIdentifier, listener: ((data: any) => any) & Comlink.ProxyMarked): eventListenerControllerIdentifier | null {
    const iFrameController = this.iFrameControllers.get(iFrameControllerIdentifier);
    if (iFrameController === undefined) return null;

    return iFrameController.addEventListener(listener);
  }

  removeEventListener(iFrameControllerIdentifier: iFrameControllerIdentifier, eventListenerControllerIdentifier: eventListenerControllerIdentifier): boolean {
    const iFrameController = this.iFrameControllers.get(iFrameControllerIdentifier);
    if (iFrameController === undefined) return false;

    return iFrameController.removeEventListener(eventListenerControllerIdentifier);
  }

  postMessage(iFrameControllerIdentifier: iFrameControllerIdentifier, message: any): boolean {
    const iFrameController = this.iFrameControllers.get(iFrameControllerIdentifier);
    if (iFrameController === undefined) return false;

    return iFrameController.postMessage(message);
  }

  loadExtension(extensionIdentifier: extensionIdentifier): Promise<boolean> {
    return this.extensionHostEndpoint.loadExtension(extensionIdentifier);
  }

  unloadExtension(extensionIdentifier: extensionIdentifier): Promise<boolean> {
    return this.extensionHostEndpoint.unloadExtension(extensionIdentifier);

  }

  resolveExtensions(): Promise<void> {
    return this.extensionHostEndpoint.resolveExtensions();
  }

  extensionState(extensionIdentifier: extensionIdentifier): Promise<extensionState | null> {
    return this.extensionHostEndpoint.extensionState(extensionIdentifier);
  }

}
