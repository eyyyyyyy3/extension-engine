import * as Comlink from "comlink";
import { extensionWorkerControllerIdentifier, uiIdentifier, endpointRightIdentifier, extensionIdentifier, NSExtensionWorker, iFrameControllerIdentifier, eventListenerControllerIdentifier } from "../types";
import { UIController } from "./ui-controller";

export class ExtensionWorkerController implements NSExtensionWorker.IEndpointLeft {
  static #currentIdentifier: extensionWorkerControllerIdentifier = 0;
  identifier: extensionWorkerControllerIdentifier;
  uiControllerIdentifiers: Set<uiIdentifier>;
  eventTargetEventListenerControllerIdentifiers: Set<eventListenerControllerIdentifier>;

  worker: Worker | null;
  endpointRightIdentifier: endpointRightIdentifier | undefined;
  extensionIdentifier: extensionIdentifier | undefined;
  extensionWorkerEndpoint: Comlink.Remote<NSExtensionWorker.IEndpointLeft>;

  constructor(worker: Worker, extensionWorkerEndpoint: Comlink.Remote<NSExtensionWorker.IEndpointLeft>) {
    this.identifier = ExtensionWorkerController.#currentIdentifier;
    ExtensionWorkerController.#currentIdentifier += 1;

    this.uiControllerIdentifiers = new Set<uiIdentifier>();
    this.eventTargetEventListenerControllerIdentifiers = new Set<eventListenerControllerIdentifier>;

    this.worker = worker;
    this.extensionWorkerEndpoint = extensionWorkerEndpoint;
  }

  loadExtenion(entrypoint: File): Promise<boolean> {
    return this.extensionWorkerEndpoint.loadExtenion(entrypoint);
  }

  unloadExtension(): Promise<void> {
    return this.extensionWorkerEndpoint.unloadExtension();
  }

  initializeExtension(): Promise<void> {
    return this.extensionWorkerEndpoint.initializeExtension();
  }

  registerUIControllerIdentifier(uiIdentifier: uiIdentifier): boolean {
    if (this.hasUIControllerIdentifier(uiIdentifier)) return false;

    this.uiControllerIdentifiers.add(uiIdentifier);
    return true;
  }

  removeUIControllerIdentifier(uiIdentifier: uiIdentifier): boolean {
    return this.uiControllerIdentifiers.delete(uiIdentifier);
  }

  getUIControllerIdentifiers(): Set<uiIdentifier> {
    return this.uiControllerIdentifiers;
  }

  hasUIControllerIdentifier(uiIdentifier: uiIdentifier): boolean {
    return this.uiControllerIdentifiers.has(uiIdentifier);
  }

  registerEventListenerControllerIdentifier(eventListenerControllerIdentifier: eventListenerControllerIdentifier): boolean {
    if (this.hasEventListenerControllerIdentifier(eventListenerControllerIdentifier)) return false;

    this.eventTargetEventListenerControllerIdentifiers.add(eventListenerControllerIdentifier);
    return true;
  }

  removeEventListenerControllerIdentifier(eventListenerControllerIdentifier: eventListenerControllerIdentifier): boolean {
    return this.eventTargetEventListenerControllerIdentifiers.delete(eventListenerControllerIdentifier);
  }

  getEventListenerControllerIdentifiers(): Set<eventListenerControllerIdentifier> {
    return this.eventTargetEventListenerControllerIdentifiers;
  }

  hasEventListenerControllerIdentifier(eventListenerControllerIdentifier: eventListenerControllerIdentifier): boolean {
    return this.eventTargetEventListenerControllerIdentifiers.has(eventListenerControllerIdentifier);
  }

  // hasUI(uiIdentifier: uiIdentifier): boolean {
  //   return this.uiControllers.has(uiIdentifier);
  // }
  //
  // registerUI(uiIdentifier: uiIdentifier, iFrameControllerIdentifier: iFrameControllerIdentifier, eventListenerControllerIdentifier: eventListenerControllerIdentifier): boolean {
  //   //If the UIController already exists we return false
  //   if (this.hasUI(uiIdentifier)) return false;
  //
  //   //Create an uiController which holds the iFrameControllerIdentifier and eventListenerControllerIdentifier
  //   const uiController = new UIController(uiIdentifier, iFrameControllerIdentifier, eventListenerControllerIdentifier);
  //
  //   //Save it to the extensionWorkerController's specific uiControllers Map. We checked before
  //   //if the Map has any entry with the provided uiIdentifier so it is safe to set/insert here
  //   this.uiControllers.set(uiController.identifier, uiController);
  //   //We are done
  //   return true;
  // }
  //
  // removeUI(uiIdentifier: uiIdentifier): boolean {
  //   return this.uiControllers.delete(uiIdentifier);
  // }
  //
  // getUIController(uiIdentifier: uiIdentifier): UIController | null {
  //   const uiController = this.uiControllers.get(uiIdentifier);
  //   if (uiController === undefined) return null;
  //   return uiController;
  // }
}
