import { endpointRightIdentifier } from "./extension-types";

export type eventControllerIdentifier = number;
export type iFrameControllerIdentifier = string;
export type extensionHostControllerIdentifier = number;

export namespace NSExtensionService {

  export interface IEndpointLeft {
    loadExtensionHost(): Promise<extensionHostControllerIdentifier>;
    unloadExtensionHost(extensionHostControllerIdentifier: extensionHostControllerIdentifier): boolean;
    //availableExtensions(extensionHostControllerIdentifier: extensionHostControllerIdentifier): ;
    //loadedExtensions(extensionHostControllerIdentifier: extensionHostControllerIdentifier);
    loadExtension(extensionIdentifier: string, extensionHostControllerIdentifier: extensionHostControllerIdentifier): Promise<boolean>;
    unloadExtension(extensionIdentifier: string, extensionHostControllerIdentifier: extensionHostControllerIdentifier): Promise<boolean>;
    status(): void;
  }


  export interface IEndpointRight {
    createIFrame(html: string, endpointRightIdentifier?: endpointRightIdentifier): iFrameControllerIdentifier | null;
    removeIFrame(iFrameIdentifier: string, endpointRightIdentifier?: endpointRightIdentifier): boolean;
    removeIFrames(endpointRightIdentifier?: endpointRightIdentifier): boolean;
    addEventListener(iFrameIdentifier: string, listener: (data: any) => any, endpointRightIdentifier?: endpointRightIdentifier): number | undefined;
    removeEventListener(iFrameIdentifier: string, eventControllerIdentifier: eventControllerIdentifier, endpointRightIdentifier?: endpointRightIdentifier): boolean;
    postMessage(iFrameIdentifier: string, data: any, endpointRightIdentifier?: endpointRightIdentifier): boolean;
  }
}
