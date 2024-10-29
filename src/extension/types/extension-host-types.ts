export type extensionWorkerControllerIdentifier = number;
export type extensionIdentifier = string;

export namespace NSExtensionHost {

  export interface IEndpointLeft {
    //Add more ways of loading an Extension for example from a Server.
    //Also, because the Identifier of an extension has to be unique globally, we can just go by the extensionIdentifier;
    loadExtension(extensionIdentifier: extensionIdentifier): Promise<boolean>;
    unloadExtension(extensionIdentifier: extensionIdentifier): Promise<boolean>;
    //forceUnloadExtension
    resolveExtensions(): Promise<void>;
  }

  export interface IEndpointRight {
    // registerUI(html: string, extensionWorkerController?: ExtensionWorkerController): UIEndpoint;

  }
}
