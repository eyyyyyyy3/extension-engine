import { eventIdentifier, eventListenerControllerIdentifier } from "../types";
import { EventListenerController } from "./event-listener-controller";

//TODO: Continue here. Implement the customEvent handler
class EventTargetController extends EventTarget {
  events: Set<string>;
  constructor() {
    super();
    this.events = new Set<eventIdentifier>();
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
    return this.dispatchEvent(new CustomEvent(event, { detail: data }));
  }

  removeEvent(event: eventIdentifier): boolean {
    //If the event does not exist we return false
    if (!this.events.has(event)) return false;
    this.events.delete(event);
    //Remove all the eventListeners that are attached to the event
    return true;
  }

}
