import { vi } from 'vitest';

const createNewProjectMocks = vi.hoisted(() => ({
    fsFinishProjectDestination: vi.fn(() => Promise.resolve()),
    fsJoin: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/'))),
    fsMkdir: vi.fn(() => Promise.resolve()),
    fsReserveProjectDestination: vi.fn((path: string) => Promise.resolve(path)),
    fsWriteTextFile: vi.fn(() => Promise.resolve()),
}));

export function getCreateNewProjectMocks() {
    return createNewProjectMocks;
}

export function resetCreateNewProjectMocks(): void {
    createNewProjectMocks.fsReserveProjectDestination.mockReset().mockImplementation((path: string) => Promise.resolve(path));
    createNewProjectMocks.fsFinishProjectDestination.mockReset().mockResolvedValue();
    createNewProjectMocks.fsJoin.mockClear();
    createNewProjectMocks.fsMkdir.mockClear();
    createNewProjectMocks.fsWriteTextFile.mockClear();

    createNewProjectMocks.fsJoin.mockImplementation((...parts: string[]) => Promise.resolve(parts.join('/')));
}

vi.mock('../services/fs', () => ({
    fsFinishProjectDestination: createNewProjectMocks.fsFinishProjectDestination,
    fsJoin: createNewProjectMocks.fsJoin,
    fsMkdir: createNewProjectMocks.fsMkdir,
    fsReserveProjectDestination: createNewProjectMocks.fsReserveProjectDestination,
    fsWriteTextFile: createNewProjectMocks.fsWriteTextFile,
}));

