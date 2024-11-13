import { spaceIdentifier, zoneIdentifier, iFrameLocation, iFrameLocationIdentifier } from "../types";

export class SpaceController {
  identifier: spaceIdentifier;
  //Kinda collapsing the ZoneController as it just has the Set and its identifier
  zones: Map<zoneIdentifier, Map<iFrameLocationIdentifier, iFrameLocation>>;
  constructor(identifier: spaceIdentifier) {
    this.identifier = identifier;
    this.zones = new Map<zoneIdentifier, Map<iFrameLocationIdentifier, iFrameLocation>>();
  }

  registerZone(zoneIdentifier: zoneIdentifier): boolean {
    //Check if the zone already exists. If it does, then return false
    if (this.hasZone(zoneIdentifier)) return false;

    this.zones.set(zoneIdentifier, new Map<iFrameLocationIdentifier, iFrameLocation>());
    return true;
  }

  registerZones(zoneIdentifiers: [zoneIdentifier]): boolean {
    for (const zoneIdentifier of zoneIdentifiers) {
      //Check if a zone with that name is already defined
      if (!this.hasZone(zoneIdentifier)) {
        //If there is none add one
        this.zones.set(zoneIdentifier, new Map<iFrameLocationIdentifier, iFrameLocation>());
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

  registerIFrameLocation(zoneIdentifier: zoneIdentifier, iFrameLocation: iFrameLocation): boolean {
    const iFrameLocations = this.zones.get(zoneIdentifier);
    if (iFrameLocations === undefined) return false;
    const iFrameLocationIdentifier = iFrameLocation.join(".");
    iFrameLocations.set(iFrameLocationIdentifier, iFrameLocation);
    return true;
  }

  removeIFrameLocation(zoneIdentifier: zoneIdentifier, iFrameLocation: iFrameLocation): boolean {
    const iFrameLocations = this.zones.get(zoneIdentifier);
    if (iFrameLocations === undefined) return false;
    const iFrameLocationIdentifier = iFrameLocation.join(".");
    return iFrameLocations.delete(iFrameLocationIdentifier);
  }

}
