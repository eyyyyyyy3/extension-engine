import * as Comlink from "comlink";
import * as ExtensionHost from "./extension-host";
import { sendExposed, awaitExposed } from "./comlink-helper";


interface IEndpointLeft {
  loadExtenion(entrypoint: File): boolean;
  unloadExtension(): void;
}

interface IEndpointRight {
  //loadUI(key: string): someHandler;
}

export class EndpointLeft implements IEndpointLeft {
  //Because there should only be one single instance of an EndpointLeft,
  //there is no need for any identifier.

  #extensionWorker: ExtensionWorker;
  constructor(extensionWorker: ExtensionWorker) {
    this.#extensionWorker = extensionWorker;
  }

  loadExtenion(entrypoint: File): boolean {
    return this.#extensionWorker.loadExtenion(entrypoint);
  }

  unloadExtension(): void {
    return this.#extensionWorker.unloadExtension();
  }

}

class EndpointRight implements IEndpointRight {
  #extensionWorker: ExtensionWorker;
  constructor(extensionWorker: ExtensionWorker) {
    this.#extensionWorker = extensionWorker;
  }

}

class ExtensionWorker implements IEndpointLeft, IEndpointRight {
  #extensionHostEndpointRight: Comlink.Remote<ExtensionHost.EndpointRight>;
  #endpointLeft: EndpointLeft;

  constructor(extensionHostEndpointRight: Comlink.Remote<ExtensionHost.EndpointRight>) {
    this.#extensionHostEndpointRight = extensionHostEndpointRight;
    this.#endpointLeft = new EndpointLeft(this as ExtensionWorker);
  }

  get endpointLeft() {
    return this.#endpointLeft;
  }

  loadExtenion(entrypoint: File): boolean {
    try {
      //Create a URL from our entrypoint for our importScripts function
      const entrypointURL = URL.createObjectURL(entrypoint);
      //Import the entrypoint
      importScripts(entrypointURL);
      //Remove the URL as it is not needed anymore
      URL.revokeObjectURL(entrypointURL);
      //PROFIT?!?!
      return true;
    } catch (error) {
      console.error(`[EXTENSION-WORKER] ${error}`);
      return false;
    }
  }

  unloadExtension(): void {

  }
}


//THE 5 STEPS TO LOADING EXTENSIONS:
//STEP 1: USE COMLINK TO EXPOSE AN API FOR EASY WORKER SETUP
//STEP 2: CREATE A FUCTION THAT TAKES SOURCE CODE OR A JS "File/Blob" WHICH HOLDS THE SOURCE CODE
//        AND CREATES A URL TO THAT FILE OR BLOB
//        YOU CAN USE "URL.createObjectURL(object)"#
//STEP 3: DO A LITTLE "importScripts()" WITH THE URL YOU CREATED ABOVE
//STEP 4: AFTER ALL THAT IS DONE YOU CAN "URL.revokeObjectURL(objectURL)"
//STEP 5: PROFIT?!?!



////----------------------------------------------------------------------------------
await awaitExposed(self);
const extensionWorker = new ExtensionWorker(Comlink.wrap<ExtensionHost.EndpointRight>(self));

Comlink.expose(extensionWorker.endpointLeft, self);
sendExposed(self);
