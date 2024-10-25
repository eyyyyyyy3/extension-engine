import { resolve } from "@tauri-apps/api/path";
import { AFS } from "../sdk";

export class WebFS extends AFS {
  exists(path: string | URL): Promise<boolean> {
    //TODO: Real implementation
    return new Promise((resolve) => resolve(false));
  }
  readFile(path: string | URL): Promise<Uint8Array> {
    //TODO: Real implementation
    const array = new Uint8Array(1);
    return new Promise((resolve) => resolve(array));
  }
}
