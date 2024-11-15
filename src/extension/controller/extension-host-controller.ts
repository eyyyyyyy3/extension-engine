import * as Comlink from "comlink";
import { extensionHostControllerIdentifier, iFrameControllerIdentifier, endpointRightIdentifier, NSExtensionHost, extensionIdentifier, extensionState, eventIdentifier } from "../types";
import { IFrameController } from "./iframe-controller";

//The ExtensionHostController hold all the relevant information of an extension-host.
//It has references to the actual web worker and all the IFrames that were opened via
//that extension-host and the actual endpoint of the extension-host. The controllers
//are used by both the left and the right ExtensionServiceEndpoints.
export class ExtensionHostController implements NSExtensionHost.IEndpointLeft {
  static #currentIdentifier: extensionHostControllerIdentifier = 0;
  identifier: extensionHostControllerIdentifier;
  iFrameControllerIdentifiers: Set<iFrameControllerIdentifier>;
  worker: Worker | null;
  extensionHostEndpoint: Comlink.Remote<NSExtensionHost.IEndpointLeft>;
  endpointRightIdentifier: endpointRightIdentifier | undefined;

  constructor(worker: Worker, extensionHostEndpoint: Comlink.Remote<NSExtensionHost.IEndpointLeft>) {
    this.identifier = ExtensionHostController.#currentIdentifier;
    this.iFrameControllerIdentifiers = new Set<iFrameControllerIdentifier>();
    ExtensionHostController.#currentIdentifier += 1;
    this.worker = worker;
    this.extensionHostEndpoint = extensionHostEndpoint;
  }

  registerIFrameControllerIdentifier(iFrameControllerIdentifier: iFrameControllerIdentifier): boolean {
    if (this.hasIFrameControllerIdentifier(iFrameControllerIdentifier)) return false;

    this.iFrameControllerIdentifiers.add(iFrameControllerIdentifier);
    return true;
  }

  removeIFrameControllerIdentifier(iFrameControllerIdentifier: iFrameControllerIdentifier): boolean {
    return this.iFrameControllerIdentifiers.delete(iFrameControllerIdentifier);
  }

  getIFrameControllerIdentifier(): Set<iFrameControllerIdentifier> {
    return this.iFrameControllerIdentifiers;
  }

  hasIFrameControllerIdentifier(iFrameControllerIdentifier: iFrameControllerIdentifier): boolean {
    return this.iFrameControllerIdentifiers.has(iFrameControllerIdentifier);
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

  registerEvent(event: eventIdentifier): Promise<boolean> {
    return this.extensionHostEndpoint.registerEvent(event);
  }

  emitEvent(event: eventIdentifier, data?: any): Promise<boolean> {
    return this.extensionHostEndpoint.emitEvent(event, data);
  }

  removeEvent(event: eventIdentifier): Promise<boolean> {
    return this.extensionHostEndpoint.removeEvent(event);
  }

  hasEventEL(event: eventIdentifier): Promise<boolean> {
    return this.extensionHostEndpoint.hasEventEL(event);
  }

  getEventsEL(): Promise<eventIdentifier[] | null> {
    return this.getEventsEL();
  }

}
