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
}
