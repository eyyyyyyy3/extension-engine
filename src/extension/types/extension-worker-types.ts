import { spaceIdentifier, uiIdentifier, zoneIdentifier } from "./extension-types";

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
  }
}
