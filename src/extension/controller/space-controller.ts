import { spaceIdentifier, zoneIdentifier, iFrameLocation } from "../types";

export class SpaceController {
  identifier: spaceIdentifier;
  //Kinda collapsing the ZoneController as it just has the Set and its identifier
  zoneSet: Map<zoneIdentifier, Set<iFrameLocation>>;
  constructor(identifier: spaceIdentifier) {
    this.identifier = identifier;
    this.zoneSet = new Map<zoneIdentifier, Set<iFrameLocation>>();
  }
}
