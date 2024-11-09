import * as Comlink from "comlink";
import { extensionWorkerControllerIdentifier, uiIdentifier, endpointRightIdentifier, extensionIdentifier, NSExtensionWorker } from "../types";
import { UIController } from "./ui-controller";

export class ExtensionWorkerController {
  static #currentIdentifier: extensionWorkerControllerIdentifier = 0;
  identifier: extensionWorkerControllerIdentifier;
  uiControllers: Map<uiIdentifier, UIController>;

  worker: Worker | null;
  endpointRightIdentifier: endpointRightIdentifier | undefined;
  extensionIdentifier: extensionIdentifier | undefined;
  extensionWorkerEndpoint: Comlink.Remote<NSExtensionWorker.IEndpointLeft>;

  constructor(worker: Worker, extensionWorkerEndpoint: Comlink.Remote<NSExtensionWorker.IEndpointLeft>) {
    this.identifier = ExtensionWorkerController.#currentIdentifier;
    ExtensionWorkerController.#currentIdentifier += 1;

    this.uiControllers = new Map<uiIdentifier, UIController>();

    this.worker = worker;
    this.extensionWorkerEndpoint = extensionWorkerEndpoint;
  }
}
