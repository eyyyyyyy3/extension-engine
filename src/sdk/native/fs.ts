import { exists, BaseDirectory, readFile, mkdir, readDir, DirEntry } from "@tauri-apps/plugin-fs";
import { IDirectoryEntry, IFS } from "../interfaces/fs";
export class NativeFS implements IFS {
  exists(path: string | URL): Promise<boolean> {
    return exists(path, { baseDir: BaseDirectory.AppLocalData });
  }
  readFile(path: string | URL): Promise<Uint8Array> {
    return readFile(path, { baseDir: BaseDirectory.AppLocalData });
  }
  mkdir(path: string | URL): Promise<void> {
    return mkdir(path, { baseDir: BaseDirectory.AppLocalData });
  }

  //Ugly but I need to convert to a common interface that is used in the Web version
  //as well as in the native version. The performance hit should be negligible
  async readDir(path: string | URL): Promise<IDirectoryEntry[]> {
    const dirEntries: DirEntry[] = await readDir(path, { baseDir: BaseDirectory.AppLocalData });
    const mappedEntries = dirEntries.map(this.convertToIDirectoryEntry);
    return mappedEntries;
  }

  convertToIDirectoryEntry(dirEntry: DirEntry): IDirectoryEntry {
    return {
      name: dirEntry.name,
      isDirectory: dirEntry.isDirectory,
      isFile: dirEntry.isFile,
      isSymlink: dirEntry.isSymlink,
    };
  }
  convertToDirEntry(directoryEntry: IDirectoryEntry): DirEntry {
    return {
      name: directoryEntry.name,
      isDirectory: directoryEntry.isDirectory,
      isFile: directoryEntry.isFile,
      isSymlink: directoryEntry.isSymlink,
    };
  }
}
