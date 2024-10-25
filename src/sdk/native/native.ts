import { ASDK } from "../abstracts/sdk";
import { NativeFS } from "./fs";

export class NativeSDK extends ASDK {
  constructor() {
    const fs = new NativeFS();
    super(fs);
  }
}
