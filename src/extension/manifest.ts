import * as V1 from "./manifest/v1";

export function parseManifest(data: any): null | V1.Manifest {

  const manifestVersion = data.manifestVersion;
  switch (manifestVersion) {
    case "1.0.0":
      {
        const parsedSchema = V1.schema.safeParse(data);
        if (!parsedSchema.success) {
          console.error(parsedSchema.error);
          return null;
        }

        return new V1.Manifest(parsedSchema.data);
      }
    //if there are future manifest updates you can add them here
    default:
      console.error("[MANIFEST] The manifestVersion is not supported or invalid!")
      return null;
  }
};

