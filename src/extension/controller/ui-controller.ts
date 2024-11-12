import { uiIdentifier, iFrameControllerIdentifier, eventListenerControllerIdentifier } from "../types";

export class UIController {
  identifier: uiIdentifier;
  iFrameControllerIdentifier: iFrameControllerIdentifier;
  eventListenerControllerIdentifier: eventListenerControllerIdentifier;
  constructor(uiIdentifier: uiIdentifier, iFrameControllerIdentifier: iFrameControllerIdentifier, eventListenerControllerIdentifier: eventListenerControllerIdentifier) {
    this.identifier = uiIdentifier;
    this.iFrameControllerIdentifier = iFrameControllerIdentifier;
    this.eventListenerControllerIdentifier = eventListenerControllerIdentifier;
  }
}
