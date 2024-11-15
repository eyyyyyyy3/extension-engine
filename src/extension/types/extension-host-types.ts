import { eventListenerControllerIdentifier } from "./extension-service-types";
import { Comlink, endpointRightIdentifier, eventIdentifier, extensionIdentifier, extensionState, spaceIdentifier, uiIdentifier, zoneIdentifier } from "./extension-types";

export type extensionWorkerControllerIdentifier = number;

export namespace NSExtensionHost {

  export interface IEndpointLeft {
    //Add more ways of loading an Extension for example from a Server.
    //Also, because the Identifier of an extension has to be unique globally, we can just go by the extensionIdentifier;
    loadExtension(extensionIdentifier: extensionIdentifier): Promise<boolean>;
    unloadExtension(extensionIdentifier: extensionIdentifier): Promise<boolean>;
    resolveExtensions(): Promise<void>;
    extensionState(extensionIdentifier: extensionIdentifier): Promise<extensionState | null>

    registerEvent(event: eventIdentifier): Promise<boolean>;
    emitEvent(event: eventIdentifier, data?: any): Promise<boolean>;
    removeEvent(event: eventIdentifier): Promise<boolean>;
    hasEvent(event: eventIdentifier): Promise<boolean>;
  }

  export interface IEndpointRight {
    registerUI(uiIdentifier: uiIdentifier, space: spaceIdentifier, zone: zoneIdentifier, listener: ((data: any) => any) & Comlink.ProxyMarked, endpointRightIdentifier?: endpointRightIdentifier): Promise<boolean>;
    removeUI(uiIdentifier: uiIdentifier, endpointRightIdentifier?: endpointRightIdentifier): Promise<boolean>;
    postMessageUI(uiIdentifier: uiIdentifier, message: any, endpointRightIdentifier?: endpointRightIdentifier): Promise<boolean>;

    registerListener(event: eventIdentifier, listener: ((data: any) => any) & Comlink.ProxyMarked, endpointRightIdentifier?: endpointRightIdentifier): Promise<eventListenerControllerIdentifier | null>;
    removeListener(eventListenerControllerIdentifier: eventListenerControllerIdentifier, endpointRightIdentifier?: endpointRightIdentifier): Promise<boolean>;
    hasListener(eventListenerControllerIdentifier: eventListenerControllerIdentifier, endpointRightIdentifier?: endpointRightIdentifier): Promise<boolean>;
  }
}
