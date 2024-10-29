import * as Comlink from "comlink";
import * as ExtensionHost from "./extension-host";
import { sendExposed, awaitExposed } from "./comlink-helper";
import { NSExtensionWorker } from "./types";



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

  unloadExtension(): void {
    return this.#extensionWorker.unloadExtension();
  }

}

class EndpointRight implements NSExtensionWorker.IEndpointRight {
  #extensionWorker: ExtensionWorker;
  constructor(extensionWorker: ExtensionWorker) {
    this.#extensionWorker = extensionWorker;
  }

}

class ExtensionWorker implements NSExtensionWorker.IEndpointLeft, NSExtensionWorker.IEndpointRight {
  #extensionHostEndpointRight: Comlink.Remote<ExtensionHost.EndpointRight>;
  #endpointLeft: EndpointLeft;
  #extension: any;
  constructor(extensionHostEndpointRight: Comlink.Remote<ExtensionHost.EndpointRight>) {
    this.#extensionHostEndpointRight = extensionHostEndpointRight;
    this.#endpointLeft = new EndpointLeft(this as ExtensionWorker);

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

      //Calling the initialize function and if it does not exist
      //we return with an error and the whole worker gets unloaded
      //Initialize is expected to be synchronous
      this.#extension.initialize();
      //PROFIT?!?!
      return true;
    } catch (error) {
      console.error(`[EXTENSION-WORKER] ${error}`);
      return false;
    }
  }

  unloadExtension(): void {
    const extension = this.#extension;
    if (extension === null) return;
    try {
      //Calling the terminate function and if it does not exist
      //it does not really matter as it will be unloaded anyways
      //Also terminate has to be synchronous
      extension.terminate();
    } catch (error) {
      console.error(`[EXTENSION-WORKER] ${error}`);
      return;
    }
  }
}



////----------------------------------------------------------------------------------
await awaitExposed(self);
const extensionWorker = new ExtensionWorker(Comlink.wrap<ExtensionHost.EndpointRight>(self));

Comlink.expose(extensionWorker.endpointLeft, self);
sendExposed(self);
