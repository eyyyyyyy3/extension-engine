import * as Comlink from "comlink";
import { EndpointRight } from "./extension-host";
import { sendExposed, awaitExposed } from "./comlink-helper";

class ExtensionWorker {
  #extensionHostEndpointRight: Comlink.Remote<EndpointRight>;
  constructor(extensionHostEndpointRight: Comlink.Remote<EndpointRight>) {
    this.#extensionHostEndpointRight = extensionHostEndpointRight;
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
const extensionHost = new ExtensionWorker(Comlink.wrap<EndpointRight>(self));

// Comlink.expose(extensionHost.endpointLeft, self);
// sendExposed(self,);
