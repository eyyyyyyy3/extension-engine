import { eventListenerControllerIdentifier } from "./extension-service-types";
import { eventIdentifier, spaceIdentifier, uiIdentifier, zoneIdentifier } from "./extension-types";

export namespace NSExtensionWorker {

  export interface IEndpointLeft {
    loadExtenion(entrypoint: File): Promise<boolean>;
    unloadExtension(): Promise<void>;
    initializeExtension(): Promise<void>;
  }

  export interface IEndpointRight {
    registerUI(uiIdentifier: uiIdentifier, space: spaceIdentifier, zone: zoneIdentifier, listener: (data: any) => any): Promise<boolean>;
    removeUI(uiIdentifier: uiIdentifier): Promise<boolean>;
    postMessageUI(uiIdentifier: uiIdentifier, message: any): Promise<boolean>;

    registerListener(event: eventIdentifier, listener: ((data: any) => any)): Promise<eventListenerControllerIdentifier | null>;
    removeListener(eventListenerControllerIdentifier: eventListenerControllerIdentifier): Promise<boolean>;
    hasListener(eventListenerControllerIdentifier: eventListenerControllerIdentifier): Promise<boolean>;

    hasEvent(event: eventIdentifier): Promise<boolean>;
    getEvents(): Promise<eventIdentifier[] | null>;
  }
}
