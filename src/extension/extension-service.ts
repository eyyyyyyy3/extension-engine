import * as Comlink from "comlink";
import { sendExposed, awaitExposed } from "./comlink-helper";
import * as ExtensionHost from "./extension-host";
import { acquireSDK } from "../sdk";
import { ASDK } from "../sdk/abstracts/sdk";

export type eventControllerIdentifier = number;
class EventController {
  static #currentIdentifier: eventControllerIdentifier = 0;
  identifier: eventControllerIdentifier;
  abortController: AbortController;
  constructor(abortController: AbortController) {
    this.identifier = EventController.#currentIdentifier;
    EventController.#currentIdentifier += 1;

    this.abortController = abortController;
  }
}

export type iFrameControllerIdentifier = string;
class IFrameController {
  static #currentIdentifier: number = 0;
  eventControllers: Map<number, EventController>;
  identifier: iFrameControllerIdentifier;
  iFrame: HTMLIFrameElement;
  constructor(iFrame: HTMLIFrameElement) {
    this.eventControllers = new Map<number, EventController>;
    this.identifier = IFrameController.#currentIdentifier.toString();
    IFrameController.#currentIdentifier += 1;
    this.iFrame = iFrame;
  }
}

export interface IExposeRight {
  endpoint: EndpointRight & Comlink.ProxyMarked;
  sdk: ASDK & Comlink.ProxyMarked;
}

//The ExtensionHostController hold all the relevant information of an extension-host.
//It has references to the actual web worker and all the IFrames that were opened via
//that extension-host and the actual endpoint of the extension-host. The controllers
//are used by both the left and the right ExtensionServiceEndpoints.
export type extensionHostControllerIdentifier = number;
class ExtensionHostController {
  static #currentIdentifier: extensionHostControllerIdentifier = 0;
  identifier: extensionHostControllerIdentifier;
  iFrameControllers: Map<string, IFrameController>;
  worker: Worker | null;
  //I should use interfaces rather that the class instance 
  //for flexibility purposes but doing that would break
  //the way I expose the right endpoints. There is a 
  //"never trust whats coming from the right" principle
  //where we manage the state from any right endpoint. Because
  //of that state management exposing the interface would make
  //for some ugly optional function parameters that we hide with 
  //the class. Any input would be ignored anyways but still.
  extensionHostEndpoint: Comlink.Remote<ExtensionHost.EndpointLeft>;
  #endpointRightIdentifier: endpointRightIdentifier | undefined;

  constructor(worker: Worker, extensionHostEndpoint: Comlink.Remote<ExtensionHost.EndpointLeft>) {
    this.identifier = ExtensionHostController.#currentIdentifier;
    this.iFrameControllers = new Map<string, IFrameController>;
    ExtensionHostController.#currentIdentifier += 1;
    this.worker = worker;
    this.extensionHostEndpoint = extensionHostEndpoint;
  }

  get endpointRightIdentifier(): endpointRightIdentifier | undefined {
    return this.#endpointRightIdentifier;
  }

  set endpointRightIdentifier(endpointRightIdentifier: endpointRightIdentifier) {
    if (this.#endpointRightIdentifier !== undefined) return;
    this.#endpointRightIdentifier = endpointRightIdentifier;
  }
}

interface IEndpointLeft {
  loadExtensionHost(): Promise<extensionHostControllerIdentifier>;
  unloadExtensionHost(extensionHostControllerIdentifier: extensionHostControllerIdentifier): boolean;
  status(): void;
}

interface IEndpointRight {
  createIFrame(html: string, endpointRightIdentifier?: endpointRightIdentifier): iFrameControllerIdentifier | null;
  removeIFrame(iFrameIdentifier: string, endpointRightIdentifier?: endpointRightIdentifier): boolean;
  removeIFrames(endpointRightIdentifier?: endpointRightIdentifier): boolean;
  addEventListener(iFrameIdentifier: string, listener: (data: any) => any, endpointRightIdentifier?: endpointRightIdentifier): number | undefined;
  removeEventListener(iFrameIdentifier: string, eventControllerIdentifier: eventControllerIdentifier, endpointRightIdentifier?: endpointRightIdentifier): boolean;
  postMessage(iFrameIdentifier: string, data: any, endpointRightIdentifier?: endpointRightIdentifier): boolean;
}

export type endpointRightIdentifier = number;

class EndpointLeft implements IEndpointLeft {
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
  status(): void {
    this.#extensionService.status();
  }

}

export class EndpointRight implements IEndpointRight {
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

  createIFrame(html: string): string | null {
    return this.#extensionService.createIFrame(html, this.#identifier);
  }

  removeIFrame(iFrameIdentifier: string): boolean {
    return this.#extensionService.removeIFrame(iFrameIdentifier, this.#identifier);
  }

  removeIFrames(): boolean {
    return this.#extensionService.removeIFrames(this.#identifier);
  }

  addEventListener(iFrameIdentifier: string, listener: (data: any) => any): number | undefined {
    return this.#extensionService.addEventListener(iFrameIdentifier, listener, this.#identifier);
  }

  removeEventListener(iFrameIdentifier: string, eventControllerIdentifier: eventControllerIdentifier): boolean {
    return this.#extensionService.removeEventListener(iFrameIdentifier, eventControllerIdentifier, this.#identifier);
  }

  postMessage(iFrameIdentifier: string, data: any): boolean {
    return this.#extensionService.postMessage(iFrameIdentifier, data, this.#identifier);
  }
}

export class ExtensionService implements IEndpointLeft, IEndpointRight {
  #app = document.getElementById("extension"); //TODO: change this later 

  //Currently because of https://github.com/tauri-apps/tauri/issues/3308#issuecomment-1025132141
  //the sdk has to be created within the context of the main thread. Because of this
  //limitation, we are creating an instance of the sdk in the constructor
  //(as ExtensionService has to be initiated inside of the main thread) and passing
  //it to the ExtensionHost as a Comlink.ProxyMarked
  #sdk: ASDK;
  #exposedExtensionServiceEndpoints: Map<endpointRightIdentifier, EndpointRight>;
  #extensionHostControllers: Map<extensionHostControllerIdentifier, ExtensionHostController>;
  #endpointLeft: EndpointLeft;

  constructor() {
    this.#exposedExtensionServiceEndpoints = new Map<endpointRightIdentifier, EndpointRight>();
    this.#extensionHostControllers = new Map<extensionHostControllerIdentifier, ExtensionHostController>();
    this.#endpointLeft = new EndpointLeft(this as ExtensionService);

    this.#sdk = acquireSDK();
  }

  get endpointLeft() {
    return this.#endpointLeft;
  }

  createIFrame(html: string, endpointRightIdentifier?: endpointRightIdentifier): iFrameControllerIdentifier | null {
    if (!endpointRightIdentifier) return null;

    const endpoint = this.#exposedExtensionServiceEndpoints.get(endpointRightIdentifier);

    if (endpoint === undefined || endpoint.extensionHostControllerIdentifier === undefined) return null;

    const extensionHostController = this.#extensionHostControllers.get(endpoint.extensionHostControllerIdentifier);
    if (!extensionHostController) return null;

    const iFrame = document.createElement("iframe");
    const iFrameController = new IFrameController(iFrame);
    iFrame.id = iFrameController.identifier;

    //TODO: Sandbox
    //iFrame.sandbox

    iFrame.srcdoc = html;
    ////----------------------------------------------------------------------------------
    //iFrame.onload = () => {
    //  const scriptContent = `
    //  setInterval(() => {
    //    window.parent.postMessage('Hello from iFrame ${iFrameController.identifier}', '*');
    //  }, 1000);
    //  window.onmessage = function (ev) {
    //    console.log(ev.data);
    //  }
    //`;
    //
    //  // Inject the script into the iFrame
    //  const script = iFrame.contentDocument?.createElement('script');
    //  if (script) {
    //    script.textContent = scriptContent;
    //    iFrame.contentDocument?.body.appendChild(script);
    //  }
    //
    //}
    ////----------------------------------------------------------------------------------

    //TODO: Think of a better way to approaching error handling.
    try {
      this.#app?.append(iFrame);
    } catch (error) {
      console.error("Could not append IFrame to the app: ", error);
      return null;
    }
    extensionHostController.iFrameControllers.set(iFrameController.identifier, iFrameController);
    return iFrameController.identifier;
  }

  removeIFrame(iFrameIdentifier: iFrameControllerIdentifier, endpointRightIdentifier?: endpointRightIdentifier): boolean {
    if (!endpointRightIdentifier) return false;

    const endpoint = this.#exposedExtensionServiceEndpoints.get(endpointRightIdentifier);

    if (endpoint === undefined || endpoint.extensionHostControllerIdentifier === undefined) return false;

    const extensionHostController = this.#extensionHostControllers.get(endpoint.extensionHostControllerIdentifier);
    if (!extensionHostController) return false;

    const iFrameController = extensionHostController.iFrameControllers.get(iFrameIdentifier);
    if (!iFrameController) return false;

    const iFrame = iFrameController.iFrame;
    if (iFrame && iFrame.parentNode) {
      for (const [_, eventController] of iFrameController.eventControllers) {
        eventController.abortController.abort();
      }
      iFrame.parentNode.removeChild(iFrame);
      return extensionHostController.iFrameControllers.delete(iFrameController.identifier);
    }
    return false;
  }

  removeIFrames(endpointRightIdentifier?: endpointRightIdentifier): boolean {
    if (!endpointRightIdentifier) return false;
    const endpoint = this.#exposedExtensionServiceEndpoints.get(endpointRightIdentifier);

    if (endpoint === undefined || endpoint.extensionHostControllerIdentifier === undefined) return false;

    const extensionHostController = this.#extensionHostControllers.get(endpoint.extensionHostControllerIdentifier);
    if (!extensionHostController) return false;

    return this.#removeIFrames(extensionHostController);
  }

  #removeIFrames(extensionHostController: ExtensionHostController): boolean {
    //TODO: Optimize later

    for (const [_, iFrameController] of extensionHostController.iFrameControllers) {
      const iFrame = iFrameController.iFrame;
      if (iFrame && iFrame.parentNode) {
        for (const [_, eventController] of iFrameController.eventControllers) {
          //Remove the reigstered events to the current IFrame
          eventController.abortController.abort();
        }
        //Remove the IFrame itself
        iFrame.parentNode.removeChild(iFrame);
      }
    }
    extensionHostController.iFrameControllers.clear();
    return true;
  }

  addEventListener(iFrameIdentifier: iFrameControllerIdentifier, listener: (data: any) => any, endpointRightIdentifier?: endpointRightIdentifier): eventControllerIdentifier | undefined {
    if (!endpointRightIdentifier) return undefined;

    const endpoint = this.#exposedExtensionServiceEndpoints.get(endpointRightIdentifier);

    if (endpoint === undefined || endpoint.extensionHostControllerIdentifier === undefined) return undefined;

    const extensionHostController = this.#extensionHostControllers.get(endpoint.extensionHostControllerIdentifier);
    if (!extensionHostController) return undefined;

    const iFrameController = extensionHostController.iFrameControllers.get(iFrameIdentifier);
    if (!iFrameController) return undefined;

    const iFrame = iFrameController.iFrame;
    if (iFrame) {
      const abortController = new AbortController();
      window.addEventListener("message", (ev) => {
        if (ev.source === iFrame.contentWindow) {
          listener(ev.data);
        }
      }, { signal: abortController.signal });
      const eventController = new EventController(abortController);

      //Add the eventController to our IFrame specific controller map
      iFrameController.eventControllers.set(eventController.identifier, eventController);
      //Return the iFrame controller 
      return eventController.identifier;
    }
    return undefined;
  }

  removeEventListener(iFrameIdentifier: string, eventControllerIdentifier: eventControllerIdentifier, endpointRightIdentifier?: endpointRightIdentifier): boolean {
    if (!endpointRightIdentifier) return false;

    const endpoint = this.#exposedExtensionServiceEndpoints.get(endpointRightIdentifier);

    if (endpoint === undefined || endpoint.extensionHostControllerIdentifier === undefined) return false;

    const extensionHostController = this.#extensionHostControllers.get(endpoint.extensionHostControllerIdentifier);
    if (!extensionHostController) return false;

    const iFrameController = extensionHostController.iFrameControllers.get(iFrameIdentifier);
    if (!iFrameController || !iFrameController.eventControllers.has(eventControllerIdentifier)) return false;

    iFrameController.eventControllers.get(eventControllerIdentifier)!.abortController.abort();
    return iFrameController.eventControllers.delete(eventControllerIdentifier);
  }

  postMessage(iFrameIdentifier: string, data: any, endpointRightIdentifier?: endpointRightIdentifier): boolean {
    if (!endpointRightIdentifier) return false;

    const endpoint = this.#exposedExtensionServiceEndpoints.get(endpointRightIdentifier);

    if (endpoint === undefined || endpoint.extensionHostControllerIdentifier === undefined) return false;

    const extensionHostController = this.#extensionHostControllers.get(endpoint.extensionHostControllerIdentifier);
    if (!extensionHostController) return false;

    const iFrameController = extensionHostController.iFrameControllers.get(iFrameIdentifier);
    if (!iFrameController) return false;

    const iFrame = iFrameController.iFrame;
    if (iFrame && iFrame.contentWindow && iFrame.contentDocument && iFrame.contentDocument.readyState == "complete") {
      iFrame.contentWindow.postMessage(data);
      return true;
    }
    return false;
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
    this.#exposedExtensionServiceEndpoints.set(endpointRight.identifier, endpointRight);

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
    if (!this.#exposedExtensionServiceEndpoints.delete(controller.endpointRightIdentifier)) return false;


    //Remove the controller from our controllers registry
    if (!this.#extensionHostControllers.delete(controller.identifier)) return false;
    return true;
  }


  status(): void {
    let numberControllers = this.#extensionHostControllers.size;
    let numberEndpoints = this.#exposedExtensionServiceEndpoints.size;
    console.log(`Currently active: ${numberControllers} controller(s) and ${numberEndpoints} endpoint(s).`);
  }
}
