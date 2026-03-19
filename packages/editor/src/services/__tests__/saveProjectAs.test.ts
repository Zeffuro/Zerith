import { beforeEach, describe, expect, it } from 'vitest';

import { getSaveProjectAsMocks, resetSaveProjectAsMocks } from '../../test-utils/registerSaveProjectAsMocks';
import { saveProjectAs } from '../saveProjectAs';

const serviceMocks = getSaveProjectAsMocks();

describe('saveProjectAs', () => {
    beforeEach(() => {
        resetSaveProjectAsMocks();
    });

    it('returns undefined when the directory picker is cancelled', async () => {
        serviceMocks.openDialog.mockResolvedValueOnce(undefined);

        const result = await saveProjectAs('/project/source');

        expect(result).toBeUndefined();
        expect(serviceMocks.fsReadDirectory).not.toHaveBeenCalled();
    });

    it('recursively copies the project tree and returns the new manifest path', async () => {
        serviceMocks.openDialog.mockResolvedValueOnce('/project/copy');

        serviceMocks.fsReadDirectory
            .mockResolvedValueOnce([
                { isDirectory: true, isFile: false, isSymlink: false, name: 'assets' },
                { isDirectory: false, isFile: true, isSymlink: false, name: 'game.json' },
            ] as never[])
            .mockResolvedValueOnce([
                { isDirectory: false, isFile: true, isSymlink: false, name: 'logo.png' },
            ] as never[]);

        serviceMocks.fsReadBinaryFile.mockImplementation(async (path?: string) => new TextEncoder().encode(path ?? ''));

        const result = await saveProjectAs('/project/source');

        expect(result).toEqual({
            manifestPath: '/project/copy/game.json',
            projectPath: '/project/copy',
        });

        expect(serviceMocks.fsMkdir).toHaveBeenCalledWith('/project/copy', true);
        expect(serviceMocks.fsMkdir).toHaveBeenCalledWith('/project/copy/assets', true);
        expect(serviceMocks.fsWriteBinaryFile).toHaveBeenCalledWith(
            '/project/copy/game.json',
            expect.any(Uint8Array),
        );
        expect(serviceMocks.fsWriteBinaryFile).toHaveBeenCalledWith(
            '/project/copy/assets/logo.png',
            expect.any(Uint8Array),
        );
    });

    it('throws when the selected target directory is the same as the source', async () => {
        serviceMocks.openDialog.mockResolvedValueOnce('/project/source');

        await expect(saveProjectAs('/project/source'))
            .rejects
            .toThrow('Save Project As target must be different from the current project folder.');
    });

    it('throws when the selected target directory is nested inside the source directory', async () => {
        serviceMocks.openDialog.mockResolvedValueOnce('/project/source/backup');

        await expect(saveProjectAs('/project/source'))
            .rejects
            .toThrow('Save Project As target cannot be nested within the current project folder.');
    });
});

