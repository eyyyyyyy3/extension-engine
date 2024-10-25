import { IDirectoryEntry, IFS } from "../interfaces/fs";

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

