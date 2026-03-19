import { vi } from 'vitest';

const createNewProjectMocks = vi.hoisted(() => ({
    fsJoin: vi.fn(async (...parts: string[]) => parts.join('/')),
    fsMkdir: vi.fn(async () => {}),
    fsWriteTextFile: vi.fn(async () => {}),
}));

export function getCreateNewProjectMocks() {
    return createNewProjectMocks;
}

export function resetCreateNewProjectMocks(): void {
    createNewProjectMocks.fsJoin.mockClear();
    createNewProjectMocks.fsMkdir.mockClear();
    createNewProjectMocks.fsWriteTextFile.mockClear();

    createNewProjectMocks.fsJoin.mockImplementation(async (...parts: string[]) => parts.join('/'));
}

vi.mock('../services/fs', () => ({
    fsJoin: createNewProjectMocks.fsJoin,
    fsMkdir: createNewProjectMocks.fsMkdir,
    fsWriteTextFile: createNewProjectMocks.fsWriteTextFile,
}));

