import { describe, expect, it, vi } from 'vitest';

import type { SaveAllResult } from '../../store/project/types';

import { saveProjectBeforeExport } from '../exportPreflight';

function project(result?: SaveAllResult) {
    const state = {
        dirtyFiles: new Set<string>(),
        projectGeneration: 1,
        projectPath: '/games/classic-vn-starter',
        saveAllDirtyFiles: vi.fn(() => Promise.resolve(result ?? { failed: [], saved: ['intro.json'], skipped: [] })),
    };
    const packageGame = vi.fn();
    const exportSavedGame = async () => {
        await saveProjectBeforeExport('/games/classic-vn-starter', () => state);
        packageGame();
    };
    return { exportSavedGame, packageGame, state };
}

describe('saving before game export', () => {
    it.each(['failed', 'skipped'] as const)('keeps packaging from starting after a %s save', async (kind) => {
        const result: SaveAllResult = {
            failed: kind === 'failed' ? ['intro.json'] : [],
            saved: [],
            skipped: kind === 'skipped' ? ['intro.json'] : [],
        };
        const run = project(result);
        await expect(run.exportSavedGame()).rejects.toThrow('intro.json');
        expect(run.packageGame).not.toHaveBeenCalled();
    });

    it('packages only after saves finish', async () => {
        const run = project();
        await run.exportSavedGame();
        expect(run.state.saveAllDirtyFiles).toHaveBeenCalledOnce();
        expect(run.packageGame).toHaveBeenCalledOnce();
    });

    it('keeps packaging from starting when edits arrive during save', async () => {
        const run = project();
        run.state.saveAllDirtyFiles.mockImplementation(() => {
            run.state.dirtyFiles.add('intro.json');
            return Promise.resolve({ failed: [], saved: ['intro.json'], skipped: [] });
        });
        await expect(run.exportSavedGame()).rejects.toThrow('changed while saving');
        expect(run.packageGame).not.toHaveBeenCalled();
    });

    it('rejects a replaced session even when the same project is reopened', async () => {
        const run = project();
        run.state.saveAllDirtyFiles.mockImplementation(() => {
            run.state.projectGeneration += 1;
            return Promise.resolve({ failed: [], saved: [], skipped: [] });
        });
        await expect(run.exportSavedGame()).rejects.toThrow('project changed');
        expect(run.packageGame).not.toHaveBeenCalled();
    });

    it('preserves save error details and never starts packaging', async () => {
        const run = project();
        run.state.saveAllDirtyFiles.mockRejectedValue(new Error('Disk is unavailable'));
        await expect(run.exportSavedGame()).rejects.toThrow('Disk is unavailable');
        expect(run.packageGame).not.toHaveBeenCalled();
    });

    it('does not save or package a different open project', async () => {
        const run = project();
        run.state.projectPath = '/games/example-game';
        await expect(run.exportSavedGame()).rejects.toThrow('project changed');
        expect(run.state.saveAllDirtyFiles).not.toHaveBeenCalled();
        expect(run.packageGame).not.toHaveBeenCalled();
    });
});
