import { ASDK } from "../sdk";
import { NativeFS } from "./fs";

export class NativeSDK extends ASDK {
  constructor() {
    super(new NativeFS());
  }
}
