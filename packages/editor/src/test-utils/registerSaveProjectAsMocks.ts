import { vi } from 'vitest';

type MockDirectoryEntry = {
    isDirectory: boolean;
    isFile: boolean;
    isSymlink: boolean;
    name: string;
};

const saveProjectAsMocks = vi.hoisted(() => ({
    fsJoin: vi.fn(async (...parts: string[]) => parts.join('/')),
    fsMkdir: vi.fn(async () => {}),
    fsReadBinaryFile: vi.fn<(_path: string) => Promise<Uint8Array>>(async (_path: string) => new Uint8Array()),
    fsReadDirectory: vi.fn<(_path: string) => Promise<MockDirectoryEntry[]>>(
        async (_path: string): Promise<MockDirectoryEntry[]> => [],
    ),
    fsWriteBinaryFile: vi.fn(async () => {}),
    openDialog: vi.fn(async (_options?: unknown) => undefined as string | undefined),
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

    saveProjectAsMocks.fsJoin.mockImplementation(async (...parts: string[]) => parts.join('/'));
    saveProjectAsMocks.fsReadDirectory.mockImplementation(async (_path: string): Promise<MockDirectoryEntry[]> => []);
    saveProjectAsMocks.fsReadBinaryFile.mockImplementation(async (_path: string) => new Uint8Array());
    saveProjectAsMocks.openDialog.mockImplementation(async (_options?: unknown) => undefined as string | undefined);
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

