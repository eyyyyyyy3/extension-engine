import * as Comlink from "comlink";
import { extensionHostControllerIdentifier, iFrameControllerIdentifier, endpointRightIdentifier, NSExtensionHost } from "../types";
import { IFrameController } from "./iframe-controller";

//The ExtensionHostController hold all the relevant information of an extension-host.
//It has references to the actual web worker and all the IFrames that were opened via
//that extension-host and the actual endpoint of the extension-host. The controllers
//are used by both the left and the right ExtensionServiceEndpoints.
export class ExtensionHostController {
  static #currentIdentifier: extensionHostControllerIdentifier = 0;
  identifier: extensionHostControllerIdentifier;
  iFrameControllers: Map<iFrameControllerIdentifier, IFrameController>;
  worker: Worker | null;
  //I should use interfaces rather that the class instance 
  //for flexibility purposes but doing that would break
  //the way I expose the right endpoints. There is a 
  //"never trust whats coming from the right" principle
  //where we manage the state from any right endpoint. Because
  //of that state management exposing the interface would make
  //for some ugly optional function parameters that we hide with 
  //the class. Any input would be ignored anyways but still.
  extensionHostEndpoint: Comlink.Remote<NSExtensionHost.IEndpointLeft>;
  endpointRightIdentifier: endpointRightIdentifier | undefined;

  constructor(worker: Worker, extensionHostEndpoint: Comlink.Remote<NSExtensionHost.IEndpointLeft>) {
    this.identifier = ExtensionHostController.#currentIdentifier;
    this.iFrameControllers = new Map<iFrameControllerIdentifier, IFrameController>;
    ExtensionHostController.#currentIdentifier += 1;
    this.worker = worker;
    this.extensionHostEndpoint = extensionHostEndpoint;
  }
}
