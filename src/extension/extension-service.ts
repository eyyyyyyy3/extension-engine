import * as Comlink from "comlink";
import { sendExposed } from "./comlink-helper";
type eventControllerIdentifier = number;
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

type iFrameControllerIdentifier = string;
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

class ExtensionHostController {
  static #currentIdentifier: extensionHostControllerIdentifier = 0;
  identifier: extensionHostControllerIdentifier;
  iFrameControllers: Map<string, IFrameController>;
  worker: Worker | null;

  constructor(worker: Worker) {
    this.identifier = ExtensionHostController.#currentIdentifier;
    this.iFrameControllers = new Map<string, IFrameController>;
    ExtensionHostController.#currentIdentifier += 1;
    this.worker = worker;
  }
}

type endpointRightIdentifier = number;
type endpointLeftIdentifier = number;
type extensionHostControllerIdentifier = number;

interface IEndpointLeft {
  loadExtensionHost(): endpointRightIdentifier;
  unloadExtensionHost(endpointIdentifier: endpointRightIdentifier): boolean;
  status(): void;
}

interface IEndpointRight {
  createIFrame(html: string, endpointRightIdentifier?: endpointRightIdentifier): iFrameControllerIdentifier | null;
  removeIFrame(iFrameIdentifier: string, endpointRightIdentifier?: endpointRightIdentifier): boolean;
  removeIFrames(endpointRightIdentifier?: endpointRightIdentifier): boolean;
  addEventListener(iFrameIdentifier: string, listener: (data: any) => any, endpointRightIdentifier?: endpointRightIdentifier): number | undefined;
  removeEventListener(iFrameIdentifier: string, controllerIdentifier: number, endpointRightIdentifier?: endpointRightIdentifier): boolean;
  postMessage(iFrameIdentifier: string, data: any, endpointRightIdentifier?: endpointRightIdentifier): boolean;
}


export class ExtensionServiceEndpointLeft implements IEndpointLeft {
  #extensionService: ExtensionService;
  constructor(extensionService: ExtensionService) {
    this.#extensionService = extensionService;
  }
  loadExtensionHost(): endpointRightIdentifier {
    return this.#extensionService.loadExtensionHost();
  }
  unloadExtensionHost(endpointIdentifier: endpointRightIdentifier): boolean {
    return this.#extensionService.unloadExtensionHost(endpointIdentifier);
  }
  status(): void {
    this.#extensionService.status();
  }
}


export class ExtensionServiceEndpointRight implements IEndpointRight {
  static #currentIdentifier: endpointRightIdentifier = 0;
  #identifier: endpointRightIdentifier;
  #extensionService: ExtensionService;
  #extensionHostControllerIdentifier: extensionHostControllerIdentifier;
  constructor(extensionService: ExtensionService, extensionHostControllerIdentifier: extensionHostControllerIdentifier) {
    this.#identifier = ExtensionServiceEndpointRight.#currentIdentifier;
    ExtensionServiceEndpointRight.#currentIdentifier += 1;
    this.#extensionService = extensionService;
    this.#extensionHostControllerIdentifier = extensionHostControllerIdentifier;
  }

  get identifier() {
    return this.#identifier;
  }

  get extensionHostControllerIdentifier() {
    return this.#extensionHostControllerIdentifier;
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

  removeEventListener(iFrameIdentifier: string, controllerIdentifier: number): boolean {
    return this.#extensionService.removeEventListener(iFrameIdentifier, controllerIdentifier, this.#identifier);
  }

  postMessage(iFrameIdentifier: string, data: any): boolean {
    return this.#extensionService.postMessage(iFrameIdentifier, data, this.#identifier);
  }
}

export class ExtensionService implements IEndpointLeft, IEndpointRight {
  #app = document.getElementById("extension"); //TODO: change this later 

  // A map from iFrameIdentifier to a map of controllerIdentifier to EventController
  #extensionHostEndpoints: Map<endpointRightIdentifier, ExtensionServiceEndpointRight>;
  #extensionHostControllers: Map<extensionHostControllerIdentifier, ExtensionHostController>;

  constructor() {
    this.#extensionHostEndpoints = new Map<endpointRightIdentifier, ExtensionServiceEndpointRight>();
    this.#extensionHostControllers = new Map<extensionHostControllerIdentifier, ExtensionHostController>();
  }

  createIFrame(html: string, endpointRightIdentifier?: endpointRightIdentifier): iFrameControllerIdentifier | null {
    if (!endpointRightIdentifier) return null;

    const endpoint = this.#extensionHostEndpoints.get(endpointRightIdentifier);

    if (!endpoint) return null;

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

    //TODO: Think of a better way to approaching error handeling.
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

    const endpoint = this.#extensionHostEndpoints.get(endpointRightIdentifier);

    if (!endpoint) return false;

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
    //TODO: Optimize later
    if (!endpointRightIdentifier) return false;

    const endpoint = this.#extensionHostEndpoints.get(endpointRightIdentifier);

    if (!endpoint) return false;

    const extensionHostController = this.#extensionHostControllers.get(endpoint.extensionHostControllerIdentifier);
    if (!extensionHostController) return false;

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

    const endpoint = this.#extensionHostEndpoints.get(endpointRightIdentifier);

    if (!endpoint) return undefined;

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

  removeEventListener(iFrameIdentifier: string, controllerIdentifier: number, endpointRightIdentifier?: endpointRightIdentifier): boolean {
    if (!endpointRightIdentifier) return false;

    const endpoint = this.#extensionHostEndpoints.get(endpointRightIdentifier);

    if (!endpoint) return false;

    const extensionHostController = this.#extensionHostControllers.get(endpoint.extensionHostControllerIdentifier);
    if (!extensionHostController) return false;

    const iFrameController = extensionHostController.iFrameControllers.get(iFrameIdentifier);
    if (!iFrameController || !iFrameController.eventControllers.has(controllerIdentifier)) return false;

    iFrameController.eventControllers.get(controllerIdentifier)!.abortController.abort();
    return iFrameController.eventControllers.delete(controllerIdentifier);
  }

  //Works but something with Comlink and the way the function is called block the call to the iframe froam a web worker
  postMessage(iFrameIdentifier: string, data: any, endpointRightIdentifier?: endpointRightIdentifier): boolean {
    if (!endpointRightIdentifier) return false;

    const endpoint = this.#extensionHostEndpoints.get(endpointRightIdentifier);

    if (!endpoint) return false;

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

  loadExtensionHost(): endpointRightIdentifier {
    //This might fails too cause of the path
    const worker = new Worker(new URL("./extension-host.ts", import.meta.url), { type: "module" });
    const controller = new ExtensionHostController(worker);
    const endpoint = new ExtensionServiceEndpointRight(this as ExtensionService, controller.identifier);

    this.#extensionHostControllers.set(controller.identifier, controller);
    this.#extensionHostEndpoints.set(endpoint.identifier, endpoint);

    Comlink.expose(endpoint, worker);
    sendExposed(worker);

    return endpoint.identifier;
  }

  unloadExtensionHost(endpointIdentifier: endpointRightIdentifier): boolean {
    //Grab the endpoint from our endpoint registry (map) 
    const endpoint = this.#extensionHostEndpoints.get(endpointIdentifier);
    if (!endpoint) return false;

    //Grab the controller from our map
    const controller = this.#extensionHostControllers.get(endpoint.extensionHostControllerIdentifier);
    if (!controller) return false;

    //Remove all created IFrames and with it all the event listeners
    this.removeIFrames(endpoint.identifier);

    //Remove the endpoint from our endpoint registry
    if (!this.#extensionHostEndpoints.delete(endpoint.identifier)) return false;

    //Terminate the worker and set our reference to null for the GC
    controller.worker!.terminate();
    controller.worker = null;

    //Remove the controller from our controllers registry
    if (!this.#extensionHostControllers.delete(controller.identifier)) return false;
    return true;
  }


  status(): void {
    let numberControllers = this.#extensionHostControllers.size;
    let numberEndpoints = this.#extensionHostEndpoints.size;
    console.log(`Currently active: ${numberControllers} controller(s) and ${numberEndpoints} endpoint(s).`);
  }
}
