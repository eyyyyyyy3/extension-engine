import { eventListenerControllerIdentifier } from "../types";

export class EventListenerController {
  static #currentIdentifier: eventListenerControllerIdentifier = 0;
  identifier: eventListenerControllerIdentifier;
  abortController: AbortController;
  constructor(abortController: AbortController) {
    this.identifier = EventListenerController.#currentIdentifier;
    EventListenerController.#currentIdentifier += 1;

    this.abortController = abortController;
  }

  abort(reason?: any): void {
    this.abortController.abort(reason);
  }
}
