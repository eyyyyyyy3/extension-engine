import * as V1 from "./manifest/v1";

export function parseManifest(data: any): null | V1.Manifest {

  const version = data.version;
  switch (version) {
    case "1.0":
      {
        const parsedSchema = V1.schema.safeParse(data);
        if (!parsedSchema.success) return null;

        return new V1.Manifest(parsedSchema.data);
      }
    //if there are future manifest updates you can add them here
    default:
      return null;
  }
};

