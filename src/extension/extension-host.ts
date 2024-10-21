import * as Comlink from "comlink";
import { exists, BaseDirectory, readFile } from "@tauri-apps/plugin-fs";
import { sendExposed, awaitExposed } from "./comlink-helper";
import * as ExtensionService from "./extension-service";

export type endpointRightIdentifier = number;
export type endpointLeftIdentifier = number;
export type extensionWorkerControllerIdentifier = number;
export type extensionIdentifier = string;

// interface IUIEndpoint {
//
// }
//
// class UIEndpoint implements IUIEndpoint {
//
// }

export interface IEndpointLeft {
  //Add more ways of loading an Extension for example from an Server.
  //Also, because the Identifier of an extension has to be unique globally, we can just go by the extensionIdentifier;
  loadExtension(extensionIdentifier: extensionIdentifier): Promise<boolean>;
  unloadExtension(extensionIdentifier: extensionIdentifier): boolean;
}

interface IEndpointRight {
  // registerUI(html: string, extensionWorkerController?: ExtensionWorkerController): UIEndpoint;

}

export class EndpointLeft implements IEndpointLeft {
  static #currentIdentifier: endpointRightIdentifier = 0;
  #identifier: endpointRightIdentifier;

  #extensionHost: ExtensionHost;
  constructor(extensionHost: ExtensionHost) {
    this.#identifier = EndpointLeft.#currentIdentifier;
    EndpointLeft.#currentIdentifier += 1;

    this.#extensionHost = extensionHost;
  }

  async loadExtension(extensionIdentifier: extensionIdentifier): Promise<boolean> {
    return this.#extensionHost.loadExtension(extensionIdentifier);
  }

  unloadExtension(extensionIdentifier: extensionIdentifier): boolean {
    return this.unloadExtension(extensionIdentifier);
  }
}

export class EndpointRight implements IEndpointRight {
  static #currentIdentifier: endpointRightIdentifier = 0;
  #identifier: endpointRightIdentifier;
  #extensionHost: ExtensionHost;
  #extensionWorkerControllerIdentifier: extensionWorkerControllerIdentifier | undefined;

  constructor(extensionHost: ExtensionHost) {
    this.#identifier = EndpointRight.#currentIdentifier;
    EndpointRight.#currentIdentifier += 1;

    this.#extensionHost = extensionHost;
  }

  get identifier(): endpointRightIdentifier {
    return this.#identifier;
  }

  get extensionWorkerControllerIdentifier(): extensionWorkerControllerIdentifier | undefined {
    return this.#extensionWorkerControllerIdentifier;
  }

  set extensionWorkerControllerIdentifier(extensionWorkerControllerIdentifier: extensionWorkerControllerIdentifier) {
    if (this.#extensionWorkerControllerIdentifier !== undefined) return;
    this.#extensionWorkerControllerIdentifier = extensionWorkerControllerIdentifier;
  }
}

class ExtensionWorkerController {
  static #currentIdentifier: extensionWorkerControllerIdentifier = 0;
  identifier: extensionWorkerControllerIdentifier;
  worker: Worker | null;
  #endpointRightIdentifier: endpointRightIdentifier | undefined;
  constructor(worker: Worker) {
    this.identifier = ExtensionWorkerController.#currentIdentifier;
    ExtensionWorkerController.#currentIdentifier += 1;
    this.worker = worker;
  }

  get endpointRightIdentifier(): endpointRightIdentifier | undefined {
    return this.#endpointRightIdentifier;
  }

  set endpointRightIdentifier(endpointRightIdentifier: endpointRightIdentifier) {
    if (this.#endpointRightIdentifier !== undefined) return;
    this.#endpointRightIdentifier = endpointRightIdentifier;
  }

  //extensionWorkerEndpoint: Comlink.Remote<ExtensionWorker.EndpointLeft> | null;
}

class ExtensionHost implements IEndpointLeft, IEndpointRight {
  #extensionWorkerEndpoints: Map<endpointRightIdentifier, EndpointRight>;
  #extensionWorkerControllers: Map<extensionWorkerControllerIdentifier, ExtensionWorkerController>;

  //This map is used to translate extensionIdentifiers to their extension-worker controller identifier;
  #extensionIdentifierControllerIdentifier: Map<extensionIdentifier, extensionWorkerControllerIdentifier>;

  #endpointLeft: EndpointLeft;
  #extensionServiceEndpointRight: Comlink.Remote<ExtensionService.EndpointRight>;

  constructor(extensionServiceEndpointRight: Comlink.Remote<ExtensionService.EndpointRight>) {
    this.#extensionWorkerEndpoints = new Map<endpointRightIdentifier, EndpointRight>();
    this.#extensionWorkerControllers = new Map<extensionWorkerControllerIdentifier, ExtensionWorkerController>;
    this.#extensionIdentifierControllerIdentifier = new Map<extensionIdentifier, extensionWorkerControllerIdentifier>;

    this.#endpointLeft = new EndpointLeft(this as ExtensionHost);

    this.#extensionServiceEndpointRight = extensionServiceEndpointRight;
  }

  get endpointLeft() {
    return this.#endpointLeft;
  }

  async loadExtension(extensionIdentifier: extensionIdentifier): Promise<boolean> {

    //Early return if the extension is already loaded
    if (this.#extensionIdentifierControllerIdentifier.has(extensionIdentifier)) return false;

    //This might fails because of the path just so you know Amer
    const worker = new Worker(new URL("./extension-worker", import.meta.url), { type: "module" });

    const controller = new ExtensionWorkerController(worker);
    const endpointRight = new EndpointRight(this as ExtensionHost);

    //Saving cross identifier references
    controller.endpointRightIdentifier = endpointRight.identifier;
    endpointRight.extensionWorkerControllerIdentifier = controller.identifier;

    this.#extensionWorkerControllers.set(controller.identifier, controller);
    this.#extensionWorkerEndpoints.set(endpointRight.identifier, endpointRight);

    Comlink.expose(endpointRight, worker);
    sendExposed(worker);

    return true;
  }

  unloadExtension(extensionIdentifier: extensionIdentifier): boolean {
    const extensionWorkerControllerIdentifier = this.#extensionIdentifierControllerIdentifier.get(extensionIdentifier);
    if (extensionWorkerControllerIdentifier === undefined) return false;

    const controller = this.#extensionWorkerControllers.get(extensionWorkerControllerIdentifier);
    if (controller === undefined || controller.endpointRightIdentifier === undefined) return false;

    if (!this.#extensionWorkerEndpoints.delete(controller.endpointRightIdentifier)) return false;

    controller.worker!.terminate();
    controller.worker = null;

    if (!this.#extensionWorkerControllers.delete(controller.identifier)) return false;
    return true;
  }

  async loadManifest(path: URL) {
    return;
  }
  // unloadExtension(extensionWorkerIdentifier: string): boolean {
  //   worker.terminate();
  //   return false;
  // }

}

////----------------------------------------------------------------------------------
await awaitExposed(self);
const extensionServiceEndpointRight = Comlink.wrap<ExtensionService.EndpointRight>(self);
const extensionHost = new ExtensionHost(extensionServiceEndpointRight);

Comlink.expose(extensionHost.endpointLeft, self);
sendExposed(self,);
