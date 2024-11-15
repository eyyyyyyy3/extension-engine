import React from "react";
import { ExtensionService } from "./extension/extension-service";

const extensionService = new ExtensionService();
export const extensionServiceL = extensionService.endpointLeft;
extensionServiceL.registerSpace("app", ["app-extension"]);
extensionServiceL.registerSpace("one", ["one-extension"]);
const extensionHostControllerIdentifier = await extensionServiceL.loadExtensionHost();
export const endpointContext = React.createContext(extensionServiceL);

await extensionServiceL.registerEvent("specialEvent", extensionHostControllerIdentifier);
await extensionServiceL.loadExtension("vici.first", extensionHostControllerIdentifier);
await extensionServiceL.emitEvent("specialEvent", extensionHostControllerIdentifier);
await extensionServiceL.emitDatafulEvent("specialEvent", { a: "string", b: 123 }, extensionHostControllerIdentifier);

// await extensionServiceL.unloadExtension("vici.first", extensionHostControllerIdentifier);
