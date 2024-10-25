import { NativeSDK } from "./native/native";
import { WebSDK } from "./web/web";

//Straight stolen from Tauri V2
export interface IDirectoryEntry {
  //The name of the entry (file name with extension or directory name).
  name: string
  // Specifies whether this entry is a directory or not.
  isDirectory: boolean
  // Specifies whether this entry is a file or not.
  isFile: boolean
  // Specifies whether this entry is a symlink or not.
  isSymlink: boolean
}

export interface IFS {
  exists(path: string | URL): Promise<boolean>;
  readFile(path: string | URL): Promise<Uint8Array>;
  mkdir(path: string | URL): Promise<void>;
  readDir(path: string | URL): Promise<IDirectoryEntry[]>;
}


export abstract class ASDK implements IFS {
  #fs: IFS;
  constructor(fs: IFS) { this.#fs = fs; }

  exists(path: string | URL): Promise<boolean> {
    //I could add logging in all these function wrappers
    return this.#fs.exists(path);
  }

  readFile(path: string | URL): Promise<Uint8Array> {
    return this.#fs.readFile(path);
  }

  mkdir(path: string | URL): Promise<void> {
    return this.#fs.mkdir(path);
  }
  readDir(path: string | URL): Promise<IDirectoryEntry[]> {
    return this.#fs.readDir(path);
  }
}


let sdk: ASDK | null = null;

export function createSDK(): ASDK {
  if (sdk === null) {
    if (window && (window as any).__TAURI__) {
      sdk = new NativeSDK();
    } else {
      sdk = new WebSDK();
    }
  }
  // Return the existing SDK instance
  return sdk!;
}

