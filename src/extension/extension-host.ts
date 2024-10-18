import * as Comlink from "comlink";
import { exists, BaseDirectory, readFile } from "@tauri-apps/plugin-fs";

type endpointRightIdentifier = number;
type endpointLeftIdentifier = number;
type extensionWorkerControllerIdentifier = number;

// interface IUIEndpoint {
//
// }
//
// class UIEndpoint implements IUIEndpoint {
//
// }

interface IEndpointLeft {
  //TODO: Should I return the controllerIdentifier or should i return EndpointRightIdentifier?
  loadExtension(extensionIdentifier: string): [extensionWorkerControllerIdentifier, endpointRightIdentifier];//Add more ways of loading an Extension for example from an Server.
  unloadExtension(endpointIdentifier: endpointRightIdentifier): boolean;
}

interface IEndpointRight {
  // registerUI(html: string, extensionWorkerController?: ExtensionWorkerController): UIEndpoint;

}

class ExtensionHostEndpointLeft implements IEndpointLeft {
  #extensionHost: ExtensionHost;
  constructor(extensionHost: ExtensionHost) {
    this.#extensionHost = extensionHost;
  }
  loadExtension(extensionIdentifier: string): [extensionWorkerControllerIdentifier, endpointRightIdentifier] {
    return this.#extensionHost.loadExtension(extensionIdentifier);
  }
  unloadExtension(endpointIdentifier: endpointRightIdentifier): boolean {
    return this.unloadExtension(endpointIdentifier);
  }
}

class ExtensionHostEndpointRight implements IEndpointRight {
  static #currentIdentifier: endpointRightIdentifier = 0;
  #identifier: endpointRightIdentifier;
  #extensionHost: ExtensionHost;
  #extensionWorkerControllerIdentifier: extensionWorkerControllerIdentifier;

  constructor(extensionHost: ExtensionHost, extensionWorkerControllerIdentifier: extensionWorkerControllerIdentifier) {
    this.#identifier = ExtensionHostEndpointRight.#currentIdentifier;
    ExtensionHostEndpointRight.#currentIdentifier += 1;

    this.#extensionHost = extensionHost;
    this.#extensionWorkerControllerIdentifier = extensionWorkerControllerIdentifier;
  }

  get identifier(): endpointRightIdentifier {
    return this.#identifier;
  }

  get extensionWorkerControllerIdentifier(): extensionWorkerControllerIdentifier {
    return this.#extensionWorkerControllerIdentifier;
  }
}

class ExtensionWorkerController {
  static #currentIdentifier: extensionWorkerControllerIdentifier = 0;
  identifier: extensionWorkerControllerIdentifier;
  worker: Worker | null;
  constructor(worker: Worker) {
    this.identifier = ExtensionWorkerController.#currentIdentifier;
    ExtensionWorkerController.#currentIdentifier += 1;
    this.worker = worker;
  }
}

class ExtensionHost implements IEndpointLeft, IEndpointRight {
  #extensionWorkerEndpoints: Map<endpointRightIdentifier, ExtensionHostEndpointRight>;
  #extensionWorkerControllers: Map<extensionWorkerControllerIdentifier, ExtensionWorkerController>;

  constructor() {
    this.#extensionWorkerEndpoints = new Map<endpointRightIdentifier, ExtensionHostEndpointRight>();
    this.#extensionWorkerControllers = new Map<extensionWorkerControllerIdentifier, ExtensionWorkerController>;
  }

  loadExtension(extensionIdentifier: string): [extensionWorkerControllerIdentifier, endpointRightIdentifier] {

    //TODO: Before creating the extension check if it exists and what not. The relevant information is safed inside of the Controller.


    const worker = new Worker("./extension-worker.ts");

    const controller = new ExtensionWorkerController(worker);
    const endpoint = new ExtensionHostEndpointRight(this as ExtensionHost, controller.identifier);

    this.#extensionWorkerControllers.set(controller.identifier, controller);
    this.#extensionWorkerEndpoints.set(endpoint.identifier, endpoint);

    Comlink.expose(endpoint, worker);

    return [controller.identifier, endpoint.identifier];
  }

  loadManifest(path: URL) {

  }

  unloadExtension(endpointIdentifier: endpointRightIdentifier): boolean {
    const extensionWorkerEndpoint = this.#extensionWorkerEndpoints.get(endpointIdentifier);
    if (!extensionWorkerEndpoint) return false;

    const extensionWorkerController = this.#extensionWorkerControllers.get(extensionWorkerEndpoint.extensionWorkerControllerIdentifier);
    if (!extensionWorkerController) return false;

    if (!this.#extensionWorkerEndpoints.delete(extensionWorkerEndpoint.identifier)) return false; //TODO: SCARYYY. PANIC OR SOME
    extensionWorkerController.worker!.terminate();
    extensionWorkerController.worker = null;

    if (!this.#extensionWorkerControllers.delete(extensionWorkerController.identifier)) return false; //TODO: SCARYY TOOO.
    return true;
  }

  // unloadExtension(extensionWorkerIdentifier: string): boolean {
  //   worker.terminate();
  //   return false;
  // }

}
