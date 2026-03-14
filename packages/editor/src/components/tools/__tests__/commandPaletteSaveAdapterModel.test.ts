import { describe, expect, it, vi } from 'vitest';

import { buildCommandPaletteSaveHandlers } from '../commandPaletteSaveAdapterModel';

describe('commandPaletteSaveAdapterModel', () => {
    it('does not call save services until returned handlers are invoked', () => {
        const saveActiveFileFromCurrentScript = vi.fn(async () => {});
        const saveAllDirtyFiles = vi.fn(async () => {});

        buildCommandPaletteSaveHandlers({
            saveActiveFileFromCurrentScript,
            saveAllDirtyFiles,
        });

        expect(saveActiveFileFromCurrentScript).not.toHaveBeenCalled();
        expect(saveAllDirtyFiles).not.toHaveBeenCalled();
    });

    it('delegates active-file save to the provided service', async () => {
        const saveActiveFileFromCurrentScript = vi.fn(() => Promise.resolve({ wrote: true }));
        const saveAllDirtyFiles = vi.fn(async () => {});

        const handlers = buildCommandPaletteSaveHandlers({
            saveActiveFileFromCurrentScript,
            saveAllDirtyFiles,
        });

        await handlers.saveActiveFileFromCurrentScript();

        expect(saveActiveFileFromCurrentScript).toHaveBeenCalledTimes(1);
        expect(saveAllDirtyFiles).not.toHaveBeenCalled();
    });

    it('delegates save-all to the provided service and preserves async completion', async () => {
        let completed = false;
        const saveActiveFileFromCurrentScript = vi.fn(async () => {});
        const saveAllDirtyFiles = vi.fn(async () => {
            await Promise.resolve();
            completed = true;
            return { changed: 2 };
        });

        const handlers = buildCommandPaletteSaveHandlers({
            saveActiveFileFromCurrentScript,
            saveAllDirtyFiles,
        });

        await handlers.saveAllDirtyFiles();

        expect(saveAllDirtyFiles).toHaveBeenCalledTimes(1);
        expect(completed).toBe(true);
    });
});

