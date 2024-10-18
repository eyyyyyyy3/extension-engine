//TODO: Add some kind of mechanism that supports multiple extension-hosts
export class EventController {
  static #currentControllerIdentifier: number = 0;
  abortController: AbortController;
  controllerIdentifier: number;
  constructor(abortController: AbortController) {
    this.abortController = abortController;
    this.controllerIdentifier = EventController.#currentControllerIdentifier;
    EventController.#currentControllerIdentifier += 1;
  }
}

export class IFrameController {
  static #currentIFrameIdentifier: number = 0;
  eventControllers: Map<number, EventController>;
  iFrameIdentifier: string;
  iFrame: HTMLIFrameElement;
  constructor(iFrame: HTMLIFrameElement) {
    this.eventControllers = new Map<number, EventController>;
    this.iFrameIdentifier = IFrameController.#currentIFrameIdentifier.toString();
    IFrameController.#currentIFrameIdentifier += 1;
    this.iFrame = iFrame;
  }
}

interface IExtensionServiceR {
  createIFrame(html: string): string | undefined;
  removeIFrame(iFrameIdentifier: string): boolean;
  addEventListener(iFrameIdentifier: string, listener: (data: any) => any): number | undefined;
  removeEventListener(iFrameIdentifier: string, controllerIdentifier: number): boolean;
  postMessage(iFrameIdentifier: string, data: any): boolean;
}


export class ExtensionServiceR implements IExtensionServiceR {
  #extensionService: ExtensionService;
  constructor(extensionService: ExtensionService) {
    this.#extensionService = extensionService;
  }

  createIFrame(html: string): string | undefined {
    return this.#extensionService.createIFrame(html);
  }

  removeIFrame(iFrameIdentifier: string): boolean {
    return this.#extensionService.removeIFrame(iFrameIdentifier);
  }

  addEventListener(iFrameIdentifier: string, listener: (data: any) => any): number | undefined {
    return this.#extensionService.addEventListener(iFrameIdentifier, listener);
  }

  removeEventListener(iFrameIdentifier: string, controllerIdentifier: number): boolean {
    return this.#extensionService.removeEventListener(iFrameIdentifier, controllerIdentifier);
  }

  postMessage(iFrameIdentifier: string, data: any): boolean {
    return this.#extensionService.postMessage(iFrameIdentifier, data);
  }
}

export class ExtensionService implements IExtensionServiceR {
  #app = document.getElementById("app");

  // A map from iFrameIdentifier to a map of controllerIdentifier to EventController
  #iFrameControllers = new Map<string, IFrameController>();

  createIFrame(html: string): string | undefined {
    const iFrame = document.createElement("iframe");
    const ifc = new IFrameController(iFrame);
    iFrame.id = ifc.iFrameIdentifier;
    iFrame.srcdoc = html;
    //----------------------------------------------------------------------------------
    iFrame.onload = () => {
      const scriptContent = `
      setInterval(() => {
        window.parent.postMessage('Hello from iFrame ${ifc.iFrameIdentifier}', '*');
      }, 1000);
      window.onmessage = function (ev) {
        console.log(ev.data);
      }
    `;

      // Inject the script into the iFrame
      const script = iFrame.contentDocument?.createElement('script');
      if (script) {
        script.textContent = scriptContent;
        iFrame.contentDocument?.body.appendChild(script);
      }

    }
    //----------------------------------------------------------------------------------

    this.#app?.append(iFrame); //TODO: Make sure this returns early when it failed! 
    this.#iFrameControllers.set(ifc.iFrameIdentifier, ifc);
    return ifc.iFrameIdentifier;
  }

  removeIFrame(iFrameIdentifier: string): boolean {
    const ifc = this.#iFrameControllers.get(iFrameIdentifier);
    if (ifc) {
      const iFrame = ifc.iFrame;
      if (iFrame && iFrame.parentNode) {
        for (const [_, ec] of ifc.eventControllers) {
          ec.abortController.abort();
        }
        iFrame.parentNode.removeChild(iFrame);
        return this.#iFrameControllers.delete(ifc.iFrameIdentifier);
      }
    }
    return false;
  }

  addEventListener(iFrameIdentifier: string, listener: (data: any) => any): number | undefined { // returns either controllerIdentifier or undefined
    const ifc = this.#iFrameControllers.get(iFrameIdentifier);
    if (ifc) {
      const iFrame = ifc.iFrame;
      if (iFrame) {
        const abortController = new AbortController();
        window.addEventListener("message", (ev) => {
          if (ev.source === iFrame.contentWindow) {
            listener(ev.data);
          }
        }, { signal: abortController.signal });
        const ec = new EventController(abortController);

        //Add the eventController to our IFrame specific controller map
        ifc.eventControllers.set(ec.controllerIdentifier, ec);
        //Return the iFrame controller 
        return ec.controllerIdentifier;
      }
    }
    return undefined;
  }

  removeEventListener(iFrameIdentifier: string, controllerIdentifier: number): boolean {
    const ifc = this.#iFrameControllers.get(iFrameIdentifier);
    if (ifc && ifc.eventControllers.has(controllerIdentifier)) {
      ifc.eventControllers.get(controllerIdentifier)!.abortController.abort();
      return ifc.eventControllers.delete(controllerIdentifier);
    }
    return false;
  }

  //Works but something with Comlink and the way the function is called block the call to the iframe froam a web worker
  postMessage(iFrameIdentifier: string, data: any): boolean {
    const ifc = this.#iFrameControllers.get(iFrameIdentifier);
    if (ifc) {
      const iFrame = ifc.iFrame;
      if (iFrame && iFrame.contentWindow && iFrame.contentDocument && iFrame.contentDocument.readyState == "complete") {
        iFrame.contentWindow.postMessage(data);
        return true;
      }
    }
    return false;
  }

}
