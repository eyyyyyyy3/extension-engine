import { Comlink, endpointRightIdentifier, extensionIdentifier, extensionState, spaceIdentifier, uiIdentifier, zoneIdentifier } from "./extension-types";

export type extensionWorkerControllerIdentifier = number;

export namespace NSExtensionHost {

  export interface IEndpointLeft {
    //Add more ways of loading an Extension for example from a Server.
    //Also, because the Identifier of an extension has to be unique globally, we can just go by the extensionIdentifier;
    loadExtension(extensionIdentifier: extensionIdentifier): Promise<boolean>;
    unloadExtension(extensionIdentifier: extensionIdentifier): Promise<boolean>;
    resolveExtensions(): Promise<void>;
    extensionState(extensionIdentifier: extensionIdentifier): Promise<extensionState | null>
  }

  export interface IEndpointRight {
    registerUI(uiIdentifier: uiIdentifier, space: spaceIdentifier, zone: zoneIdentifier, listener: ((data: any) => any) & Comlink.ProxyMarked, endpointRightIdentifier?: endpointRightIdentifier): Promise<boolean>;
    removeUI(uiIdentifier: uiIdentifier, endpointRightIdentifier?: endpointRightIdentifier): Promise<boolean>;
    postMessageUI(uiIdentifier: uiIdentifier, message: any, endpointRightIdentifier?: endpointRightIdentifier): Promise<boolean>;
  }
}
