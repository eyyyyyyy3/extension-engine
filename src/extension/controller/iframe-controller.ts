import { eventControllerIdentifier, iFrameControllerIdentifier, spaceZoneLocation } from "../types";
import { EventController } from "./event-controller";

export class IFrameController {
  static #currentIdentifier: number = 0;
  eventControllers: Map<eventControllerIdentifier, EventController>;
  identifier: iFrameControllerIdentifier;
  iFrame: HTMLIFrameElement;
  spaceZoneLocation: spaceZoneLocation;
  constructor(iFrame: HTMLIFrameElement, spaceZoneLocation: spaceZoneLocation) {
    this.eventControllers = new Map<eventControllerIdentifier, EventController>;
    this.identifier = IFrameController.#currentIdentifier.toString();
    IFrameController.#currentIdentifier += 1;
    this.iFrame = iFrame;
    this.spaceZoneLocation = spaceZoneLocation;
  }
}
