import { ASDK } from "./abstracts/sdk";
import { NativeSDK } from "./native/native";
import { WebSDK } from "./web/web";

let sdk: ASDK | null = null;

export function acquireSDK(): ASDK {
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

