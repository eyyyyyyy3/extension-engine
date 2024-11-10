import { z } from "zod";

const runtimeEnum = z.enum(["native", "web", "universal"]);

//Manifest description for Manifest version 1
export const schema = z.object({
  manifestVersion: z.literal("1.0"),                                              //Manifest Version. Predefined values which we make public to developers
  apiVersion: z.string(),                                                         //The API version required to run this extension. Version must be parseable by node-semve
  runtime: runtimeEnum,                                                           //Where the extension is intended to run. Native has fs access for example
  name: z.string(),                                                               //The extensions name
  publisher: z.string(),                                                          //The extension publisher. This is also unique t the Marketplace
  version: z.string(),                                                            //The version of the current extension. Version must be parseable by node-semver
  license: z.string(),                                                            //https://docs.npmjs.com/cli/v7/configuring-npm/package-json#license
  displayName: z.string(),                                                        //The display name for the extension used in the Marketplace. It is unique
  description: z.string().optional(),                                             //A description of the extension
  website: z.string().url().optional(),                                           //The link to the website of the extension creator
  sponsor: z.string().url().optional(),                                           //A link for people if they want to sponsor the extension
  entrypoint: z.string().refine(
    (val) => val.endsWith(".js"),
    { message: "[MANIFEST] The entrypoint file has to end with .js!" }
  ),                                                                              //The path/name of the entrypoint of the extension
  //TODO: Check if the version is according to the node-semve specification
  extensionDependencies: z.tuple([z.string(), z.string()]).array().optional(),    //If extensions depend on other extensions, they can be defined in here. It goes [identifier, version]
  icon: z.string().refine(
    (val) => val.endsWith(".png"),
    { message: "[MANIFEST] The icon file has to end with .png!" }
  ),                                                                              //The path to the icon of the extension. Check size later. The format is png
  autoLoad: z.boolean().optional().default(false),                                //Should the extension be loaded automatically? Default: false
  ui: z.record(z.string().refine(
    (val) => val.endsWith(".html"),
    { message: "[MANIFEST] UI files have to end with .html!" }
  )).optional(),                                                                  //Similar to figmas ui definition
  developmentKey: z.string().optional(),                                          //Used for partners who want access to the DB while in development
})


export interface IManifest {
  manifestVersion(): string;
  apiVersion(): string;
  runtime(): string;
  publisher(): string;
  name(): string;
  identifier(): string; //The combination of publisher.name
  version(): string;
  license(): string;
  displayName(): string;
  description(): string | undefined;
  website(): string | undefined;
  sponsor(): string | undefined;
  entrypoint(): string;
  extensionDependencies(): [string, string][] | undefined;
  icon(): string;
  autoLoad(): boolean;
  ui(): Record<string, string> | undefined;
  developmentKey(): string | undefined;
}

export class Manifest implements IManifest {
  #parsedData: z.infer<typeof schema>;
  constructor(data: z.infer<typeof schema>) {
    this.#parsedData = data;
  };

  manifestVersion(): string {
    return this.#parsedData.manifestVersion;
  }
  apiVersion(): string {
    return this.#parsedData.apiVersion;
  }
  runtime(): string {
    return this.#parsedData.runtime;
  }
  publisher(): string {
    return this.#parsedData.publisher;
  }
  name(): string {
    return this.#parsedData.name;
  }
  identifier(): string {
    return this.#parsedData.publisher.concat(".", this.#parsedData.name);
  }
  version(): string {
    return this.#parsedData.version;
  }
  license(): string {
    return this.#parsedData.license;//TODO: maybe have some nicer license thing going on
  }
  displayName(): string {
    return this.#parsedData.displayName;
  }
  description(): string | undefined {
    return this.#parsedData.description;
  }
  website(): string | undefined {
    return this.#parsedData.website;
  }
  sponsor(): string | undefined {
    return this.#parsedData.sponsor;
  }
  entrypoint(): string {
    //TODO: Sanitize the so that no path traversal is possible
    return this.#parsedData.entrypoint;
  }
  extensionDependencies(): [string, string][] | undefined {
    return this.#parsedData.extensionDependencies;
  }
  icon(): string {
    //TODO: Sanitize the path so that no path traversal is possible
    return this.#parsedData.icon;
  }
  autoLoad(): boolean {
    return this.#parsedData.autoLoad;
  }
  ui(): Record<string, string> | undefined {
    //TODO: Sanitize the so that no path traversal is possible
    return this.#parsedData.ui;
  }
  developmentKey(): string | undefined {
    return this.#parsedData.developmentKey;
  }
}
