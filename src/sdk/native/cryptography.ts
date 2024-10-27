import { ICryptography } from "../interfaces/cryptography";
import { invoke } from "@tauri-apps/api/core";

export class NativeCryptography implements ICryptography {
  blake3(data: Uint8Array): Promise<Uint8Array> {
    const hash: Promise<Uint8Array> = invoke("blake3", { data: data });
    return hash;
  }
}
