import * as Comlink from "comlink";
import { sendExposed, awaitExposed } from "./comlink-helper";
import * as ExtensionService from "./extension-service";
import * as V1 from "./manifest/v1";
import { parseManifest } from "./manifest";
import { acquireSDK } from "../sdk/sdk";
import { ASDK } from "../sdk/abstracts/sdk";

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

export class Extension {
  identifier: extensionIdentifier;
  location: string;
  manifest: V1.Manifest;
  entrypoint: File | undefined;
  icon: File | undefined;
  classification: string; //official, development, malicious
  state: string; //dormant, active, quarantine
  blake3: string;
  numericIdentifier: number | undefined;
  extensionWorkerControllerIdentifier: extensionWorkerControllerIdentifier | undefined;
  private constructor(identifier: extensionIdentifier, location: string, manifest: V1.Manifest,
    classification: string, state: string, blake3: string,
    entrypoint?: File, icon?: File, numericIdentifier?: number) {
    this.identifier = identifier;
    this.location = location;
    this.manifest = manifest;
    this.entrypoint = entrypoint;
    this.icon = icon;
    this.classification = classification;
    this.state = state;
    this.blake3 = blake3;
    this.numericIdentifier = numericIdentifier;
    this.extensionWorkerControllerIdentifier = undefined;
  }

  // static async new(location: string): Promise<Extension | null> {
  //   //TODO: Replace with the new SDK function wrapper
  //   //if (!await readFile(location.concat("/", "manifest.json"))) return null;
  //
  //   return null;
  // }
}

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

  #sdk: ASDK;

  #endpointLeft: EndpointLeft;
  #extensionServiceEndpointRight: Comlink.Remote<ExtensionService.EndpointRight>;

  constructor(extensionServiceEndpointRight: Comlink.Remote<ExtensionService.EndpointRight>) {
    this.#extensionWorkerEndpoints = new Map<endpointRightIdentifier, EndpointRight>();
    this.#extensionWorkerControllers = new Map<extensionWorkerControllerIdentifier, ExtensionWorkerController>;

    this.#sdk = acquireSDK();

    this.#endpointLeft = new EndpointLeft(this as ExtensionHost);

    this.#extensionServiceEndpointRight = extensionServiceEndpointRight;
  }

  get endpointLeft() {
    return this.#endpointLeft;
  }

  async loadExtension(extensionIdentifier: extensionIdentifier): Promise<boolean> {

    //Early return if the extension is already loaded
    //TODO: Rework
    //if (this.#extensionIdentifierControllerIdentifier.has(extensionIdentifier)) return false;

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
    //TODO: Rework

    // const extensionWorkerControllerIdentifier = this.#extensionIdentifierControllerIdentifier.get(extensionIdentifier);
    // if (extensionWorkerControllerIdentifier === undefined) return false;
    //
    // const controller = this.#extensionWorkerControllers.get(extensionWorkerControllerIdentifier);
    // if (controller === undefined || controller.endpointRightIdentifier === undefined) return false;
    //
    // if (!this.#extensionWorkerEndpoints.delete(controller.endpointRightIdentifier)) return false;
    //
    // controller.worker!.terminate();
    // controller.worker = null;
    //
    // if (!this.#extensionWorkerControllers.delete(controller.identifier)) return false;
    return true;
  }

  async resolveExtensions(): Promise<boolean> {
    //TODO: Create an extension object, classify it and set the state to dormant or quarantine
    const pluginDirectories = await this.#sdk.readDir("plugins");
    console.log(pluginDirectories);

    const extensions: Extension[] = [];

    for (const directory of pluginDirectories) {
      if (!directory.isDirectory) continue;

      const manifestPath = directory.name.concat("/manifest.json");
      if (!await this.#sdk.exists(manifestPath)) continue;

      const textDecoder = new TextDecoder();

      //transform the raw u8 bytes to text and then parse it to a JSON object
      const rawManifest = await this.#sdk.readFile(manifestPath);
      const jsonManifestString = textDecoder.decode(rawManifest);
      const jsonManifest = JSON.parse(jsonManifestString);

      const manifest = parseManifest(jsonManifest);
      if (manifest === null) continue;

      const entrypointPath = manifest.entrypoint();
      if (!await this.#sdk.exists(entrypointPath)) continue;

      const iconPath = manifest.icon();
      if (!await this.#sdk.exists(iconPath)) continue;

      const rawEntrypoint: Uint8Array = await this.#sdk.readFile(entrypointPath);
      const entrypoint = new File([rawEntrypoint], "entrypoint", { type: "text/javascript" });

      const rawIcon = await this.#sdk.readFile(iconPath);
      const icon = new File([rawIcon], "icon", { type: "image/png" });
      //TODO: Continue here
    }
    return false;
  }

}

////----------------------------------------------------------------------------------
await awaitExposed(self);
const extensionServiceEndpointRight = Comlink.wrap<ExtensionService.EndpointRight>(self);
const extensionHost = new ExtensionHost(extensionServiceEndpointRight);

Comlink.expose(extensionHost.endpointLeft, self);
sendExposed(self,);
