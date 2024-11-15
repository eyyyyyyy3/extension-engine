import * as Comlink from "comlink";
import * as ExtensionHost from "./extension-host";
import { sendExposed, awaitExposed } from "./comlink-helper";
import { eventIdentifier, eventListenerControllerIdentifier, NSExtensionWorker, spaceIdentifier, uiIdentifier, zoneIdentifier } from "./types";



export class EndpointLeft implements NSExtensionWorker.IEndpointLeft {
  //Because there should only be one single instance of an EndpointLeft,
  //there is no need for any identifier.

  #extensionWorker: ExtensionWorker;
  constructor(extensionWorker: ExtensionWorker) {
    this.#extensionWorker = extensionWorker;
  }

  loadExtenion(entrypoint: File): Promise<boolean> {
    return this.#extensionWorker.loadExtenion(entrypoint);
  }

  unloadExtension(): Promise<void> {
    return this.#extensionWorker.unloadExtension();
  }

  initializeExtension(): Promise<void> {
    return this.#extensionWorker.initializeExtension();
  }

}

class EndpointRight implements NSExtensionWorker.IEndpointRight {
  #extensionWorker: ExtensionWorker;
  constructor(extensionWorker: ExtensionWorker) {
    this.#extensionWorker = extensionWorker;
  }

  registerUI(uiIdentifier: uiIdentifier, space: spaceIdentifier, zone: zoneIdentifier, listener: (data: any) => any): Promise<boolean> {
    return this.#extensionWorker.registerUI(uiIdentifier, space, zone, listener);
  }

  removeUI(uiIdentifier: uiIdentifier): Promise<boolean> {
    return this.#extensionWorker.removeUI(uiIdentifier);
  }

  postMessageUI(uiIdentifier: uiIdentifier, message: any): Promise<boolean> {
    return this.#extensionWorker.postMessageUI(uiIdentifier, message);
  }

  registerListener(event: eventIdentifier, listener: ((data: any) => any)): Promise<eventListenerControllerIdentifier | null> {
    return this.#extensionWorker.registerListener(event, listener);
  }

  removeListener(eventListenerControllerIdentifier: eventListenerControllerIdentifier): Promise<boolean> {
    return this.#extensionWorker.removeListener(eventListenerControllerIdentifier);
  }

  hasListener(eventListenerControllerIdentifier: eventListenerControllerIdentifier): Promise<boolean> {
    return this.#extensionWorker.hasListener(eventListenerControllerIdentifier);
  }

  hasEvent(event: eventIdentifier): Promise<boolean> {
    return this.#extensionWorker.hasEvent(event);
  }

  getEvents(): Promise<eventIdentifier[] | null> {
    return this.#extensionWorker.getEvents();
  }

}

class ExtensionWorker implements NSExtensionWorker.IEndpointLeft, NSExtensionWorker.IEndpointRight {
  #extensionHostEndpointRight: Comlink.Remote<ExtensionHost.EndpointRight>;
  #endpointLeft: EndpointLeft;
  #endpointRight: EndpointRight;
  #extension: any;
  constructor(extensionHostEndpointRight: Comlink.Remote<ExtensionHost.EndpointRight>) {
    this.#extensionHostEndpointRight = extensionHostEndpointRight;
    this.#endpointLeft = new EndpointLeft(this as ExtensionWorker);
    this.#endpointRight = new EndpointRight(this as ExtensionWorker);

    this.#extension = null;
  }

  get endpointLeft() {
    return this.#endpointLeft;
  }

  async loadExtenion(entrypoint: File): Promise<boolean> {
    try {
      //Create a URL from our entrypoint for our import function
      const entrypointURL = URL.createObjectURL(entrypoint);

      //Import the entrypoint and bind the import to a variable
      this.#extension = await import(/* @vite-ignore */entrypointURL);

      //Remove the URL as it is not needed anymore
      URL.revokeObjectURL(entrypointURL);

      //PROFIT?!?!
      return true;
    } catch (error) {
      console.error(`[EXTENSION-WORKER] ${error}`);
      return false;
    }
  }

  async unloadExtension(): Promise<void> {
    const extension = this.#extension;
    if (extension === null) return;
    try {
      //Calling the terminate function and if it does not exist
      //it does not really matter as it will be unloaded anyways
      //Also terminate has to be synchronous
      await extension.terminate();
    } catch (error) {
      console.error(`[EXTENSION-WORKER] ${error}`);
      return;
    }
  }

  async initializeExtension(): Promise<void> {
    //Calling the initialize function and if it does not exist
    //we return with an error and the whole worker gets unloaded
    //Initialize is expected to be synchronous
    await this.#extension.initialize(this.#endpointRight);
    return;
  }

  registerUI(uiIdentifier: uiIdentifier, space: spaceIdentifier, zone: zoneIdentifier, listener: (data: any) => any): Promise<boolean> {
    //The function will be passed across different workers and for the callback to work it has to be a Comlink.proxy
    const proxyListener = Comlink.proxy(listener);
    return this.#extensionHostEndpointRight.registerUI(uiIdentifier, space, zone, proxyListener);
  }

  removeUI(uiIdentifier: uiIdentifier): Promise<boolean> {
    return this.#extensionHostEndpointRight.removeUI(uiIdentifier);
  }

  postMessageUI(uiIdentifier: uiIdentifier, message: any): Promise<boolean> {
    return this.#extensionHostEndpointRight.postMessageUI(uiIdentifier, message);
  }

  registerListener(event: eventIdentifier, listener: ((data: any) => any)): Promise<eventListenerControllerIdentifier | null> {
    //The function will be passed across different workers and for the callback to work it has to be a Comlink.proxy
    const proxyListener = Comlink.proxy(listener);
    return this.#extensionHostEndpointRight.registerListener(event, proxyListener);
  }

  removeListener(eventListenerControllerIdentifier: eventListenerControllerIdentifier): Promise<boolean> {
    return this.#extensionHostEndpointRight.removeListener(eventListenerControllerIdentifier);
  }

  hasListener(eventListenerControllerIdentifier: eventListenerControllerIdentifier): Promise<boolean> {
    return this.#extensionHostEndpointRight.hasListener(eventListenerControllerIdentifier);
  }

  hasEvent(event: eventIdentifier): Promise<boolean> {
    return this.#extensionHostEndpointRight.hasEventER(event);
  }

  getEvents(): Promise<eventIdentifier[] | null> {
    return this.#extensionHostEndpointRight.getEventsER();
  }

}



////----------------------------------------------------------------------------------
await awaitExposed(self);
const extensionWorker = new ExtensionWorker(Comlink.wrap<ExtensionHost.EndpointRight>(self));

Comlink.expose(extensionWorker.endpointLeft, self);
sendExposed(self);
