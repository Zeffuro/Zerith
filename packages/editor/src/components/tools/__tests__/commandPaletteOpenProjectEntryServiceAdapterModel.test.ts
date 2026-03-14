import { describe, expect, it, vi } from 'vitest';

import { buildCommandPaletteOpenProjectEntryServiceHandler } from '../commandPaletteOpenProjectEntryServiceAdapterModel';

describe('commandPaletteOpenProjectEntryServiceAdapterModel', () => {
    it('does not call openProjectEntryService until the returned handler is invoked', () => {
        const openProjectEntryService = vi.fn(async () => {});

        buildCommandPaletteOpenProjectEntryServiceHandler({ openProjectEntryService });

        expect(openProjectEntryService).not.toHaveBeenCalled();
    });

    it('forwards path/name args unchanged to openProjectEntryService', async () => {
        const openProjectEntryService = vi.fn(async () => {});
        const handler = buildCommandPaletteOpenProjectEntryServiceHandler({ openProjectEntryService });

        await handler('/project/game.json', 'game.json');

        expect(openProjectEntryService).toHaveBeenCalledTimes(1);
        expect(openProjectEntryService).toHaveBeenCalledWith('/project/game.json', 'game.json');
    });

    it('awaits async completion from openProjectEntryService', async () => {
        let completed = false;
        const openProjectEntryService = vi.fn(async () => {
            await Promise.resolve();
            completed = true;
        });
        const handler = buildCommandPaletteOpenProjectEntryServiceHandler({ openProjectEntryService });

        await handler('/project/scripts/intro.json', 'intro.json');

        expect(completed).toBe(true);
    });
});

