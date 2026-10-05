import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSaveProjectAsMocks, resetSaveProjectAsMocks } from '../../test-utils/registerSaveProjectAsMocks';
import { saveProjectAs } from '../saveProjectAs';

const serviceMocks = getSaveProjectAsMocks();

describe('saveProjectAs', () => {
    beforeEach(() => {
        resetSaveProjectAsMocks();
    });

    it('returns undefined when the directory picker is cancelled', async () => {
        serviceMocks.openDialog.mockImplementationOnce(() => Promise.resolve(undefined));

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

        serviceMocks.fsReadBinaryFile.mockImplementation((path?: string) => Promise.resolve(new TextEncoder().encode(path ?? '')));

        const result = await saveProjectAs('/project/source');

        expect(result).toEqual({
            manifestPath: '/project/copy/game.json',
            projectPath: '/project/copy',
        });

        expect(serviceMocks.fsReserveProjectDestination).toHaveBeenCalledWith('/project/copy', '/project/source');
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

    it.each(['/project/source', '/project/source/backup', '/project'])('does not write when reservation rejects %s', async target => {
        serviceMocks.openDialog.mockResolvedValueOnce(target);
        serviceMocks.fsReadDirectory.mockResolvedValueOnce([{ isDirectory: false, isFile: true, isSymlink: false, name: 'game.json' }]);
        serviceMocks.fsReserveProjectDestination.mockRejectedValueOnce(new Error('Unsafe destination'));
        await expect(saveProjectAs('/project/source')).rejects.toThrow('Unsafe destination');
        expect(serviceMocks.fsWriteBinaryFile).not.toHaveBeenCalled();
        expect(serviceMocks.fsMkdir).not.toHaveBeenCalled();
    });

    it('does not save after picker cancellation', async () => {
        const beforeCopy = vi.fn();
        await saveProjectAs('/project/source', { beforeCopy });
        expect(beforeCopy).not.toHaveBeenCalled();
        expect(serviceMocks.fsReserveProjectDestination).not.toHaveBeenCalled();
    });

    it('stops before reservation after failed source save', async () => {
        serviceMocks.openDialog.mockResolvedValueOnce('/project/copy');
        await expect(saveProjectAs('/project/source', { beforeCopy: () => Promise.reject(new Error('Save failed')) })).rejects.toThrow('Save failed');
        expect(serviceMocks.fsReserveProjectDestination).not.toHaveBeenCalled();
        expect(serviceMocks.fsReadDirectory).not.toHaveBeenCalled();
    });

    it('rejects a stale picker response before saving or writing', async () => {
        let current = true;
        const beforeCopy = vi.fn();
        serviceMocks.openDialog.mockImplementationOnce(() => { current = false; return Promise.resolve('/project/copy'); });
        await expect(saveProjectAs('/project/source', { beforeCopy, isCurrent: () => current })).rejects.toThrow('changed');
        expect(beforeCopy).not.toHaveBeenCalled();
        expect(serviceMocks.fsReserveProjectDestination).not.toHaveBeenCalled();
    });

    it('rejects source links before reserving output', async () => {
        serviceMocks.openDialog.mockResolvedValueOnce('/project/copy');
        serviceMocks.fsReadDirectory.mockResolvedValueOnce([{ isDirectory: true, isFile: false, isSymlink: true, name: 'alias' }]);
        await expect(saveProjectAs('/project/source')).rejects.toThrow('source entry');
        expect(serviceMocks.fsReserveProjectDestination).not.toHaveBeenCalled();
    });

    it('reports partial output without finishing reservation after an I/O failure', async () => {
        serviceMocks.openDialog.mockResolvedValueOnce('/project/copy');
        serviceMocks.fsReadDirectory.mockResolvedValueOnce([{ isDirectory: false, isFile: true, isSymlink: false, name: 'game.json' }]);
        serviceMocks.fsReadBinaryFile.mockRejectedValueOnce(new Error('Read denied'));
        await expect(saveProjectAs('/project/source')).rejects.toThrow('Partial project output remains at /project/copy');
        expect(serviceMocks.fsFinishProjectDestination).not.toHaveBeenCalled();
    });
});
