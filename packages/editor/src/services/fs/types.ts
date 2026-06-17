export type FsAdapter = {
    dirname: (path: string) => Promise<string>;
    join: (...parts: string[]) => Promise<string>;
    mkdir: (path: string, recursive?: boolean) => Promise<void>;
    openPath: (path: string) => Promise<void>;
    pickDirectory: (title?: string) => Promise<string | undefined>;
    pickProjectManifest: () => Promise<FsProjectPickerResult | undefined>;
    readBinaryFile: (path: string) => Promise<Uint8Array>;
    readDirectory: (path: string) => Promise<FsDirectoryEntry[]>;
    readTextFile: (path: string) => Promise<string>;
    remove: (path: string, recursive?: boolean) => Promise<void>;
    rename: (oldPath: string, newPath: string) => Promise<void>;
    writeBinaryFile: (path: string, content: Uint8Array) => Promise<void>;
    writeTextFile: (path: string, content: string) => Promise<void>;
};

export type FsDirectoryEntry = {
    isDirectory: boolean;
    isFile: boolean;
    isSymlink: boolean;
    name: string;
};

export type FsProjectPickerResult = {
    manifestPath: string;
    projectPath: string;
};
