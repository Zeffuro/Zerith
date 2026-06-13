import { vi } from 'vitest';

const createNewProjectMocks = vi.hoisted(() => ({
    fsJoin: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/'))),
    fsMkdir: vi.fn(() => Promise.resolve()),
    fsWriteTextFile: vi.fn(() => Promise.resolve()),
}));

export function getCreateNewProjectMocks() {
    return createNewProjectMocks;
}

export function resetCreateNewProjectMocks(): void {
    createNewProjectMocks.fsJoin.mockClear();
    createNewProjectMocks.fsMkdir.mockClear();
    createNewProjectMocks.fsWriteTextFile.mockClear();

    createNewProjectMocks.fsJoin.mockImplementation((...parts: string[]) => Promise.resolve(parts.join('/')));
}

vi.mock('../services/fs', () => ({
    fsJoin: createNewProjectMocks.fsJoin,
    fsMkdir: createNewProjectMocks.fsMkdir,
    fsWriteTextFile: createNewProjectMocks.fsWriteTextFile,
}));

