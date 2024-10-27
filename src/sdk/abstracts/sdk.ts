import { IDirectoryEntry, IFS } from "../interfaces/fs";
import { ICryptography } from "../interfaces/cryptography";

export abstract class ASDK implements IFS, ICryptography {
  #fs: IFS;
  #cryptography: ICryptography;
  constructor(fs: IFS, cryptography: ICryptography) { this.#fs = fs; this.#cryptography = cryptography; }

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

  blake3(data: Uint8Array): Promise<Uint8Array> {
    return this.#cryptography.blake3(data);
  }
}

