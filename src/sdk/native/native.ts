import { ASDK } from "../abstracts/sdk";
import { NativeCryptography } from "./cryptography";
import { NativeFS } from "./fs";

export class NativeSDK extends ASDK {
  constructor() {
    const fs = new NativeFS();
    const cryptography = new NativeCryptography();
    super(fs, cryptography);
  }
}
