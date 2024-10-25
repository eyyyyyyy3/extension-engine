import { IDirectoryEntry, IFS } from "../interfaces/fs";

export class WebFS implements IFS {
  exists(path: string | URL): Promise<boolean> {
    //TODO: Real implementation
    return new Promise((resolve) => resolve(false));
  }
  readFile(path: string | URL): Promise<Uint8Array> {
    //TODO: Real implementation
    const array = new Uint8Array(1);
    return new Promise((resolve) => resolve(array));
  }
  mkdir(path: string | URL): Promise<void> {
    return new Promise((resolve) => resolve());
  }
  readDir(path: string | URL): Promise<IDirectoryEntry[]> {
    return new Promise((resolve) => resolve([]));
  }

}
