import * as Comlink from "comlink";
import { sendExposed, awaitExposed } from "./comlink-helper";
import * as ExtensionService from "./extension-service";
import * as V1 from "./manifest/v1";

import { parseManifest } from "./manifest";

import { ASDK } from "../sdk/abstracts/sdk";
import { exists } from "@tauri-apps/plugin-fs";

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
  location: string | URL;
  manifest: V1.Manifest;
  entrypoint: File | undefined;
  icon: File | undefined;
  ui: Map<string, File> | undefined;
  classification: string; //official, development, malicious, unknown
  state: string; //dormant, active, quarantine
  blake3: Uint8Array;
  numericIdentifier: number | undefined;
  extensionWorkerControllerIdentifier: extensionWorkerControllerIdentifier | undefined;
  constructor(identifier: extensionIdentifier, location: string, manifest: V1.Manifest,
    classification: string, state: string, blake3: Uint8Array,
    entrypoint?: File, icon?: File, ui?: Map<string, File>, numericIdentifier?: number) {
    this.identifier = identifier;
    this.location = location;
    this.manifest = manifest;
    this.entrypoint = entrypoint;
    this.icon = icon;
    this.ui = ui;
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

interface IEndpointLeft {
  //Add more ways of loading an Extension for example from a Server.
  //Also, because the Identifier of an extension has to be unique globally, we can just go by the extensionIdentifier;
  loadExtension(extensionIdentifier: extensionIdentifier): Promise<boolean>;
  unloadExtension(extensionIdentifier: extensionIdentifier): boolean;
  resolveExtensions(): Promise<void>;
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

  loadExtension(extensionIdentifier: extensionIdentifier): Promise<boolean> {
    return this.#extensionHost.loadExtension(extensionIdentifier);
  }

  unloadExtension(extensionIdentifier: extensionIdentifier): boolean {
    return this.#extensionHost.unloadExtension(extensionIdentifier);
  }

  resolveExtensions(): Promise<void> {
    return this.#extensionHost.resolveExtensions();
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
  #extensions: Map<extensionIdentifier, Extension>;

  #sdk: Comlink.Remote<ASDK>;

  #endpointLeft: EndpointLeft;
  #extensionServiceEndpointRight: Comlink.Remote<ExtensionService.EndpointRight>;

  constructor(extensionServiceEndpointRight: Comlink.Remote<ExtensionService.EndpointRight>, sdk: Comlink.Remote<ASDK>) {
    this.#extensionWorkerEndpoints = new Map<endpointRightIdentifier, EndpointRight>();
    this.#extensionWorkerControllers = new Map<extensionWorkerControllerIdentifier, ExtensionWorkerController>();
    this.#extensions = new Map<extensionIdentifier, Extension>();

    this.#sdk = sdk;

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

  async resolveExtensions(): Promise<void> {
    //Check if plugins exists and if not create the plugins dir and return
    if (!await this.#sdk.exists("plugins")) {
      await this.#sdk.mkdir("plugins");
      return;
    }

    const pluginDirectories = await this.#sdk.readDir("./plugins");

    //Labeled loop cause we want to skip the current plugin even when in some nested loop
    for (const directory of pluginDirectories) {
      //If error then continue to the next entry
      try {
        if (!directory.isDirectory) continue;

        //The current plugins path
        const pluginPath = "./plugins/".concat(directory.name, "/");

        const manifestPath = pluginPath.concat("manifest.json");
        if (!await this.#sdk.exists(manifestPath)) continue;

        const textDecoder = new TextDecoder();
        //transform the raw u8 bytes to text and then parse it to a JSON object
        const rawManifest = await this.#sdk.readFile(manifestPath);
        const jsonManifestString = textDecoder.decode(rawManifest);
        const jsonManifest = JSON.parse(jsonManifestString);
        const manifest = parseManifest(jsonManifest);
        if (manifest === null) continue;

        const entrypointPath = pluginPath.concat(manifest.entrypoint());
        if (!await this.#sdk.exists(entrypointPath)) continue;

        const iconPath = pluginPath.concat(manifest.icon());
        if (!await this.#sdk.exists(iconPath)) continue;

        const rawEntrypoint: Uint8Array = await this.#sdk.readFile(entrypointPath);
        const entrypoint = new File([rawEntrypoint], "entrypoint", { type: "text/javascript" });

        const rawIcon = await this.#sdk.readFile(iconPath);
        const icon = new File([rawIcon], "icon", { type: "image/png" });

        //Grab all the ui files
        const uiRecord = manifest.ui();

        let uiMap: Map<string, File> | undefined;
        let rawUIArray: Uint8Array[] = [];

        if (uiRecord !== undefined) {
          uiMap = new Map<string, File>();

          for (const key in uiRecord) {
            if (uiRecord.hasOwnProperty(key)) {
              const uiPath = pluginPath.concat(uiRecord[key]);

              if (!await this.#sdk.exists(uiPath))
                throw new Error(`[MANIFEST] ${uiPath} not found! Make sure it exists!`);

              const rawUI = await this.#sdk.readFile(uiPath);
              const ui = new File([rawUI], key, { type: "text/html" });
              uiMap.set(key, ui);

              rawUIArray.push(rawUI);
            }
          }
        }

        const hashData = mergeUint8Arrays(rawManifest, rawEntrypoint, rawIcon, ...rawUIArray);

        const blake3 = await this.#sdk.blake3(hashData);

        //TODO: Continue here

        //TODO: Classification & state & numericIdentifier

        const extension = new Extension(
          manifest.identifier(),
          pluginPath,
          manifest,
          "unknown",
          "dormant",
          blake3,
          entrypoint,
          icon,
          uiMap
        );

        //TODO: Additional checks if the plugin is already loaded. Currently if there
        //are two extensions with the same identifier the newer one will overwrite
        this.#extensions.set(extension.identifier, extension);
      } catch (error) {
        console.error(error);
        continue;
      }
    }
    console.log(this.#extensions);
  }

}

function mergeUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  // Calculate the total length of all arrays
  const totalLength = arrays.reduce((acc, array) => acc + array.length, 0);

  // Create a new Uint8Array with the total length
  const mergedArray = new Uint8Array(totalLength);

  // Copy each array into the new merged array
  let offset = 0;
  for (const array of arrays) {
    mergedArray.set(array, offset);
    offset += array.length;
  }

  return mergedArray;
}

////----------------------------------------------------------------------------------

await awaitExposed(self);
const { endpoint, sdk } = Comlink.wrap<ExtensionService.IExposeRight>(self);
const extensionHost = new ExtensionHost(endpoint, sdk);
Comlink.expose(extensionHost.endpointLeft, self);
sendExposed(self);
