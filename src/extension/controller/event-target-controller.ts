import * as Comlink from "comlink";
import { eventIdentifier, eventListenerControllerIdentifier } from "../types";
import { EventListenerController } from "./event-listener-controller";

//TODO: Continue here. Implement the customEvent handler
class EventTargetController extends EventTarget {
  events: Set<string>;
  eventListenerControllers: Map<eventListenerControllerIdentifier, EventListenerController>;
  constructor() {
    super();
    this.events = new Set<eventIdentifier>();
    this.eventListenerControllers = new Map<eventListenerControllerIdentifier, EventListenerController>();
  }

  registerEvent(event: eventIdentifier): boolean {
    //If the event already exists we return false
    if (this.events.has(event)) return false;
    this.events.add(event);
    return true;
  }

  emitEvent(event: eventIdentifier, data?: any): boolean {
    //If the event does not exist we return false
    if (!this.events.has(event)) return false;
    return super.dispatchEvent(new CustomEvent(event, { detail: data }));
  }

  removeEvent(event: eventIdentifier): boolean {
    //If the event does not exist we return false
    if (!this.events.has(event)) return false;
    this.events.delete(event);
    //Remove all the eventListeners that are attached to the event
    return true;
  }

  registerListener(event: eventIdentifier, listener: ((data: any) => any) & Comlink.ProxyMarked): eventListenerControllerIdentifier {
    const abortController = new AbortController();

    super.addEventListener(event, (ev) => {
      if (ev instanceof CustomEvent) {
        listener(ev.detail);
      }
      else {
        console.error("[EVENT-TARGET-CONTROLLER] Expected the event to be of type CustomEvent.");
      }

    }, { signal: abortController.signal });

    const eventListenerController = new EventListenerController(abortController);

    this.eventListenerControllers.set(eventListenerController.identifier, eventListenerController);
    return eventListenerController.identifier;
  }

  removeListener(eventListenerControllerIdentifier: eventListenerControllerIdentifier): boolean {
    if (!this.hasListenerController(eventListenerControllerIdentifier)) return false;

    this.eventListenerControllers.get(eventListenerControllerIdentifier)!.abort();
    return this.eventListenerControllers.delete(eventListenerControllerIdentifier);
  }

  hasListenerController(eventListenerControllerIdentifier: eventListenerControllerIdentifier) {
    return this.eventListenerControllers.has(eventListenerControllerIdentifier);
  }
}
