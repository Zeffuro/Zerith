import { vi } from 'vitest';

type MockDirectoryEntry = {
    isDirectory: boolean;
    isFile: boolean;
    isSymlink: boolean;
    name: string;
};

const saveProjectAsMocks = vi.hoisted(() => ({
    fsJoin: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/'))),
    fsMkdir: vi.fn(() => Promise.resolve()),
    fsReadBinaryFile: vi.fn<(_path: string) => Promise<Uint8Array>>(() => Promise.resolve(new Uint8Array())),
    fsReadDirectory: vi.fn<(_path: string) => Promise<MockDirectoryEntry[]>>(
        () => Promise.resolve([]),
    ),
    fsWriteBinaryFile: vi.fn(() => Promise.resolve()),
    openDialog: vi.fn<(_options?: unknown) => Promise<string | undefined>>(() => Promise.resolve(undefined)),
}));

export function getSaveProjectAsMocks() {
    return saveProjectAsMocks;
}

export function resetSaveProjectAsMocks(): void {
    saveProjectAsMocks.fsJoin.mockClear();
    saveProjectAsMocks.fsMkdir.mockClear();
    saveProjectAsMocks.fsReadBinaryFile.mockClear();
    saveProjectAsMocks.fsReadDirectory.mockClear();
    saveProjectAsMocks.fsWriteBinaryFile.mockClear();
    saveProjectAsMocks.openDialog.mockClear();

    saveProjectAsMocks.fsJoin.mockImplementation((...parts: string[]) => Promise.resolve(parts.join('/')));
    saveProjectAsMocks.fsReadDirectory.mockImplementation(() => Promise.resolve([]));
    saveProjectAsMocks.fsReadBinaryFile.mockImplementation(() => Promise.resolve(new Uint8Array()));
    saveProjectAsMocks.openDialog.mockImplementation(() => Promise.resolve(undefined as string | undefined));
}

vi.mock('../services/fs', () => ({
    fsJoin: saveProjectAsMocks.fsJoin,
    fsMkdir: saveProjectAsMocks.fsMkdir,
    fsReadBinaryFile: saveProjectAsMocks.fsReadBinaryFile,
    fsReadDirectory: saveProjectAsMocks.fsReadDirectory,
    fsWriteBinaryFile: saveProjectAsMocks.fsWriteBinaryFile,
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
    open: saveProjectAsMocks.openDialog,
}));

