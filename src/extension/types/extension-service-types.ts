import { Comlink, endpointRightIdentifier, extensionIdentifier, spaceIdentifier, zoneIdentifier } from "./extension-types";

export type eventListenerControllerIdentifier = number;
export type eventTargetControllerIdentifier = number;
export type iFrameControllerIdentifier = string;
export type extensionHostControllerIdentifier = number;

export type spaceZoneLocation = [spaceIdentifier, zoneIdentifier];
export type spaceZones = [spaceIdentifier, zoneIdentifier[]];
export type iFrameLocation = [extensionHostControllerIdentifier, iFrameControllerIdentifier];
export type iFrameLocationIdentifier = string;

export namespace NSExtensionService {

  export interface IEndpointLeft {
    loadExtensionHost(): Promise<extensionHostControllerIdentifier>;
    unloadExtensionHost(extensionHostControllerIdentifier: extensionHostControllerIdentifier): boolean;
    //availableExtensions(extensionHostControllerIdentifier: extensionHostControllerIdentifier): ;
    //loadedExtensions(extensionHostControllerIdentifier: extensionHostControllerIdentifier);
    loadExtension(extensionIdentifier: extensionIdentifier, extensionHostControllerIdentifier: extensionHostControllerIdentifier): Promise<boolean>;
    unloadExtension(extensionIdentifier: extensionIdentifier, extensionHostControllerIdentifier: extensionHostControllerIdentifier): Promise<boolean>;

    registerSpace(spaceIdentifier: spaceIdentifier, zoneIdentifiers?: [zoneIdentifier]): boolean;
    registerZone(spaceIdentifier: spaceIdentifier, zoneIdentifier: zoneIdentifier): boolean;

    loadSpace(spaceIdentifier: spaceIdentifier): boolean;
    unloadSpace(spaceIdentifier: spaceIdentifier): boolean;
    updateSpace(spaceIdentifier: spaceIdentifier): boolean;

    status(): void;
  }


  export interface IEndpointRight {
    registerIFrame(ui: File, spaceZoneLocation: spaceZoneLocation, endpointRightIdentifier?: endpointRightIdentifier): iFrameControllerIdentifier | null;
    removeIFrame(iFrameControllerIdentifier: iFrameControllerIdentifier, endpointRightIdentifier?: endpointRightIdentifier): boolean;
    removeIFrames(endpointRightIdentifier?: endpointRightIdentifier): boolean;
    addEventListener(iFrameControllerIdentifier: iFrameControllerIdentifier, listener: ((data: any) => any) & Comlink.ProxyMarked, endpointRightIdentifier?: endpointRightIdentifier): eventListenerControllerIdentifier | null;
    removeEventListener(iFrameControllerIdentifier: iFrameControllerIdentifier, eventListenerControllerIdentifier: eventListenerControllerIdentifier, endpointRightIdentifier?: endpointRightIdentifier): boolean;
    postMessage(iFrameControllerIdentifier: iFrameControllerIdentifier, message: any, endpointRightIdentifier?: endpointRightIdentifier): boolean;
    getSpaces(endpointRightIdentifier?: endpointRightIdentifier): spaceZones[] | null;
    hasSpaceZone(spaceZoneLocation: spaceZoneLocation, endpointRightIdentifier?: endpointRightIdentifier): boolean;
  }
}
