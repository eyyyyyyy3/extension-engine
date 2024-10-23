import * as V1 from "./manifest/v1";

function parseManifest(data: any): undefined | V1.Manifest {

  const version = data.version;
  switch (version) {
    case "1.0":
      {
        const parsedSchema = V1.schema.safeParse(data);
        if (!parsedSchema.success) return undefined;

        return new V1.Manifest(parsedSchema.data);
      }
    //if there are future manifest updates you can add them here
    default:
      return undefined;
  }
};

