import { uiIdentifier, iFrameControllerIdentifier, eventListenerControllerIdentifier } from "../types";

export class UIController {
  static #currentIdentifier: uiIdentifier = 0;
  identifier: uiIdentifier;
  iFrameControllerIdentifier: iFrameControllerIdentifier;
  eventListenerControllerIdentifier: eventListenerControllerIdentifier;
  constructor(iFrameControllerIdentifier: iFrameControllerIdentifier, eventListenerControllerIdentifier: eventListenerControllerIdentifier) {
    this.identifier = UIController.#currentIdentifier;
    UIController.#currentIdentifier += 1;

    this.iFrameControllerIdentifier = iFrameControllerIdentifier;
    this.eventListenerControllerIdentifier = eventListenerControllerIdentifier;
  }
}
