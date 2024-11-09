import { eventControllerIdentifier } from "../types";

export class EventController {
  static #currentIdentifier: eventControllerIdentifier = 0;
  identifier: eventControllerIdentifier;
  abortController: AbortController;
  constructor(abortController: AbortController) {
    this.identifier = EventController.#currentIdentifier;
    EventController.#currentIdentifier += 1;

    this.abortController = abortController;
  }
}
