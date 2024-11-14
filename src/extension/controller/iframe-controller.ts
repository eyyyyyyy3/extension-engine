import * as Comlink from "comlink";
import { eventListenerControllerIdentifier, iFrameControllerIdentifier, spaceZoneLocation } from "../types";
import { EventListenerController } from "./event-listener-controller";

export class IFrameController {
  static #currentIdentifier: number = 0;
  eventListenerControllers: Map<eventListenerControllerIdentifier, EventListenerController>;
  identifier: iFrameControllerIdentifier;
  iFrame: HTMLIFrameElement;
  spaceZoneLocation: spaceZoneLocation;
  constructor(iFrame: HTMLIFrameElement, spaceZoneLocation: spaceZoneLocation) {
    this.eventListenerControllers = new Map<eventListenerControllerIdentifier, EventListenerController>;
    this.identifier = IFrameController.#currentIdentifier.toString();
    IFrameController.#currentIdentifier += 1;
    this.iFrame = iFrame;
    this.spaceZoneLocation = spaceZoneLocation;
  }

  registerListener(listener: ((data: any) => any) & Comlink.ProxyMarked): eventListenerControllerIdentifier {
    const abortController = new AbortController();
    //Because IFrames can only live inside of the main thread anyways its okay
    //to access the window object inside of the controller
    window.addEventListener("message", (ev) => {
      if (ev.source === this.iFrame.contentWindow) {
        //Instead of just returning the ev.data
        //this could be changed to Comlink.transferHandlers
        //which would allow us to return more data in
        //a more structured way
        listener(ev.data);
      }
    }, { signal: abortController.signal });
    const eventListenerController = new EventListenerController(abortController);

    //Add the eventListenerController to our IFrame specific controller map
    this.eventListenerControllers.set(eventListenerController.identifier, eventListenerController);
    //Return the iFrame controller 
    return eventListenerController.identifier;
  }

  removeListener(eventListenerControllerIdentifier: eventListenerControllerIdentifier): boolean {
    if (!this.hasListener(eventListenerControllerIdentifier)) return false;

    this.eventListenerControllers.get(eventListenerControllerIdentifier)!.abort();
    return this.eventListenerControllers.delete(eventListenerControllerIdentifier);
  }

  hasListener(eventListenerControllerIdentifier: eventListenerControllerIdentifier) {
    return this.eventListenerControllers.has(eventListenerControllerIdentifier);
  }

  postMessage(message: any): boolean {
    if (this.iFrame.contentWindow && this.iFrame.contentDocument && this.iFrame.contentDocument.readyState == "complete") {
      this.iFrame.contentWindow.postMessage(message);
      return true;
    }
    return false;
  }

}
