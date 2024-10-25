import { ASDK } from "../sdk";
import { WebFS } from "./fs";

export class WebSDK extends ASDK {
  constructor() {
    super(new WebFS());
  }
}
