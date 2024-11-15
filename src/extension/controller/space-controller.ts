import { iFrameControllerIdentifier, spaceIdentifier, zoneIdentifier } from "../types";

export class SpaceController {
  identifier: spaceIdentifier;
  //Kinda collapsing the ZoneController as it just has the Set and its identifier
  zones: Map<zoneIdentifier, Set<iFrameControllerIdentifier>>;
  constructor(identifier: spaceIdentifier) {
    this.identifier = identifier;
    this.zones = new Map<zoneIdentifier, Set<iFrameControllerIdentifier>>();
  }

  registerZone(zoneIdentifier: zoneIdentifier): boolean {
    //Check if the zone already exists. If it does, then return false
    if (this.hasZone(zoneIdentifier)) return false;

    this.zones.set(zoneIdentifier, new Set<iFrameControllerIdentifier>());
    return true;
  }

  registerZones(zoneIdentifiers: [zoneIdentifier]): boolean {
    for (const zoneIdentifier of zoneIdentifiers) {
      //Check if a zone with that name is already defined
      if (!this.hasZone(zoneIdentifier)) {
        //If there is none add one
        this.zones.set(zoneIdentifier, new Set<iFrameControllerIdentifier>());
      }
    }
    return true;
  }

  hasZone(zoneIdentifier: zoneIdentifier): boolean {
    return this.zones.has(zoneIdentifier);
  }

  getZones(): zoneIdentifier[] {
    return Array.from(this.zones.keys());
  }

  registerIFrameControllerIdentifier(zoneIdentifier: zoneIdentifier, iFrameControllerIdentifier: iFrameControllerIdentifier): boolean {
    const iFrameControllerIdentifiers = this.zones.get(zoneIdentifier);
    if (iFrameControllerIdentifiers === undefined) return false;
    iFrameControllerIdentifiers.add(iFrameControllerIdentifier);
    return true;
  }

  removeIFrameControllerIdentifier(zoneIdentifier: zoneIdentifier, iFrameControllerIdentifier: iFrameControllerIdentifier): boolean {
    const iFrameControllerIdentifiers = this.zones.get(zoneIdentifier);
    if (iFrameControllerIdentifiers === undefined) return false;
    return iFrameControllerIdentifiers.delete(iFrameControllerIdentifier);
  }

}
