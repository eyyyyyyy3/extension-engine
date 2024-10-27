import { ASDK } from "./abstracts/sdk";
import { NativeSDK } from "./native/native";

let sdk: ASDK | null = null;

export function acquireSDK(): ASDK {
  if (sdk === null) {
    sdk = new NativeSDK();
  }
  // Return the existing SDK instance
  return sdk!;
}
