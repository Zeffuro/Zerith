import { describe, expect, it, vi } from 'vitest';

import type { AssetImportServiceDependencies } from '../assetImport';

import { AssetImportError, importAssetFiles } from '../assetImport';

function dependencies(): AssetImportServiceDependencies {
    return {
        copyFileExclusive: vi.fn<() => Promise<void>>().mockResolvedValue(),
        join: (...parts) => Promise.resolve(parts.join('/')),
        mkdir: vi.fn<() => Promise<void>>().mockResolvedValue(),
        pickBinaryFiles: vi.fn<() => Promise<never[]>>().mockResolvedValue([]),
        readDirectory: vi.fn<() => Promise<never[]>>().mockResolvedValue([]),
        writeBinaryFile: vi.fn<() => Promise<void>>().mockResolvedValue(),
    };
}

describe('native asset import', () => {
    const files = [{ name: 'hero.png', path: '/selected/hero.png' }, { name: 'theme.ogg', path: '/selected/theme.ogg' }];

    it('copies filesystem paths without loading bytes in JavaScript', async () => {
        const deps = dependencies();
        const result = await importAssetFiles('/project', files, {}, deps);
        expect(result.imported).toHaveLength(2);
        expect(deps.copyFileExclusive).toHaveBeenCalledWith('/selected/hero.png', '/project/assets/sprites/hero.png');
        expect(deps.writeBinaryFile).not.toHaveBeenCalled();
    });

    it('resolves a concurrent destination collision without overwriting it', async () => {
        const deps = dependencies();
        deps.copyFileExclusive = vi.fn<(source: string, target: string) => Promise<void>>()
            .mockRejectedValueOnce({ code: 'alreadyExists', message: 'occupied' }).mockResolvedValue();
        const result = await importAssetFiles('/project', files.slice(0, 1), {}, deps);
        expect(result.imported[0]?.targetName).toBe('hero_2.png');
        expect(result.imported[0]?.collisionResolved).toBe(true);
        expect(deps.copyFileExclusive).toHaveBeenLastCalledWith('/selected/hero.png', '/project/assets/sprites/hero_2.png');
    });

    it('returns partial progress when an import fails', async () => {
        const deps = dependencies();
        deps.copyFileExclusive = vi.fn<() => Promise<void>>().mockResolvedValueOnce().mockRejectedValueOnce(new Error('source vanished'));
        const error = await importAssetFiles('/project', files, {}, deps).catch((error_: unknown) => error_);
        expect(error).toBeInstanceOf(AssetImportError);
        expect(error).toMatchObject({ failed: { sourceName: 'theme.ogg' }, imported: [{ sourceName: 'hero.png' }] });
    });

    it('cancellation preserves completed files and skips queued copies', async () => {
        const deps = dependencies();
        const controller = new AbortController();
        deps.copyFileExclusive = vi.fn<() => Promise<void>>().mockImplementation(() => {
            controller.abort();
            return Promise.resolve();
        });
        const error = await importAssetFiles('/project', files, { signal: controller.signal }, deps).catch((error_: unknown) => error_);
        expect(error).toMatchObject({ failed: { sourceName: 'theme.ogg' }, imported: [{ sourceName: 'hero.png' }] });
        expect(deps.copyFileExclusive).toHaveBeenCalledTimes(1);
    });
});
