import * as Comlink from "comlink";
import { eventIdentifier, eventListenerControllerIdentifier } from "../types";
import { EventListenerController } from "./event-listener-controller";

export class EventTargetController extends EventTarget {
  events: Map<eventIdentifier, Set<eventListenerControllerIdentifier>>;
  eventListenerControllers: Map<eventListenerControllerIdentifier, EventListenerController>;
  constructor() {
    super();
    this.events = new Map<eventIdentifier, Set<eventListenerControllerIdentifier>>();
    this.eventListenerControllers = new Map<eventListenerControllerIdentifier, EventListenerController>();
  }

  registerEvent(event: eventIdentifier): boolean {
    //If the event already exists we return false
    if (this.hasEvent(event)) return false;
    this.events.set(event, new Set<eventListenerControllerIdentifier>());
    return true;
  }

  emitEvent(event: eventIdentifier, data?: any): boolean {
    //If the event does not exist we return false
    if (!this.events.has(event)) return false;
    return super.dispatchEvent(new CustomEvent(event, { detail: data }));
  }

  removeEvent(event: eventIdentifier): boolean {
    //If the event does not exist we return false
    if (!this.hasEvent(event)) return false;
    //We already checked if the event exists so we just use the "!" operator here
    //We get the Set of eventListenerControllerIdentifiers of the specified event which
    //is to be removed
    const eventListenerControllerIdentifiers = this.events.get(event)!.values();

    //We iterate over all the eventListenerControllerIdentifiers of the event and call
    //the removeListener function on them
    for (const eventListenerControllerIdentifier of eventListenerControllerIdentifiers) {
      if (!this.removeListener(eventListenerControllerIdentifier)) console.error("[EVENT-TARGET-CONTROLLER] Could not remove the listener.");
    }

    //At the end we delete the event from our events Map
    return this.events.delete(event);
  }

  hasEvent(event: eventIdentifier): boolean {
    return this.events.has(event);
  }

  getEvents(): eventIdentifier[] {
    return Array.from(this.events.keys());
  }

  registerListener(event: eventIdentifier, listener: ((data: any) => any) & Comlink.ProxyMarked): eventListenerControllerIdentifier | null {
    //If the event does not exist we return null
    if (!this.hasEvent(event)) return null;

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
    if (!this.hasListener(eventListenerControllerIdentifier)) return false;

    this.eventListenerControllers.get(eventListenerControllerIdentifier)!.abort();
    return this.eventListenerControllers.delete(eventListenerControllerIdentifier);
  }

  removeListeners(): void {
    for (const [_, eventListenerController] of this.eventListenerControllers) {
      eventListenerController.abort();
    }
    this.eventListenerControllers.clear();
    return;
  }

  hasListener(eventListenerControllerIdentifier: eventListenerControllerIdentifier): boolean {
    return this.eventListenerControllers.has(eventListenerControllerIdentifier);
  }

  getListenerController(eventListenerControllerIdentifier: eventListenerControllerIdentifier): EventListenerController | null {
    const eventListenerController = this.eventListenerControllers.get(eventListenerControllerIdentifier);
    if (eventListenerController === undefined) return null;
    return eventListenerController;
  }
}
