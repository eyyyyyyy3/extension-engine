import { uiIdentifier, iFrameControllerIdentifier, eventControllerIdentifier } from "../types";

export class UIController {
  identifier: uiIdentifier;
  iFrameControllerIdentifier: iFrameControllerIdentifier;
  eventControllerIdentifier: eventControllerIdentifier;
  constructor(uiIdentifier: uiIdentifier, iFrameControllerIdentifier: iFrameControllerIdentifier, eventControllerIdentifier: eventControllerIdentifier) {
    this.identifier = uiIdentifier;
    this.iFrameControllerIdentifier = iFrameControllerIdentifier;
    this.eventControllerIdentifier = eventControllerIdentifier;
  }
}
