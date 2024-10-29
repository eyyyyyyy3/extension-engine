export namespace NSExtensionWorker {

  export interface IEndpointLeft {
    loadExtenion(entrypoint: File): Promise<boolean>;
    unloadExtension(): void;
  }

  export interface IEndpointRight {
    //loadUI(key: string): someHandler;
  }
}
