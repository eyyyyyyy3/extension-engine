//Straight stolen from Tauri V2
export interface IDirectoryEntry {
  //The name of the entry (file name with extension or directory name).
  name: string
  // Specifies whether this entry is a directory or not.
  isDirectory: boolean
  // Specifies whether this entry is a file or not.
  isFile: boolean
  // Specifies whether this entry is a symlink or not.
  isSymlink: boolean
}

export interface IFS {
  exists(path: string | URL): Promise<boolean>;
  readFile(path: string | URL): Promise<Uint8Array>;
  mkdir(path: string | URL): Promise<void>;
  readDir(path: string | URL): Promise<IDirectoryEntry[]>;
}
