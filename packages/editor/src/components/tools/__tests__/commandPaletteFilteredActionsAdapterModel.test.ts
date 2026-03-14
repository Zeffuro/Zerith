import { describe, expect, it, vi } from 'vitest';

import { buildCommandPaletteFilteredActions } from '../commandPaletteFilteredActionsAdapterModel';

describe('commandPaletteFilteredActionsAdapterModel', () => {
    it('builds actions with deps, filters by query, and returns filtered array reference', () => {
        const actionDeps = {
            activeFile: '/project/scripts/intro.json',
            addRecentProject: vi.fn(),
            clearAllBreakpoints: vi.fn(),
            isPlaybackPaused: false,
            isRunning: true,
            markManualSave: vi.fn(),
            openGlobalSearchPopup: vi.fn(),
            openGlobalSearchReplacePopup: vi.fn(),
            openInitialProjectEntry: vi.fn(async () => {}),
            openProjectFromManifest: vi.fn(async () => {}),
            openSettingsModal: vi.fn(),
            recentProjects: [{ name: 'Demo', path: '/project/game.json' }],
            resetDockLayout: vi.fn(),
            saveActiveFileFromCurrentScript: vi.fn(async () => {}),
            saveAllDirtyFiles: vi.fn(async () => {}),
            triggerPause: vi.fn(),
            triggerPlay: vi.fn(),
            triggerResume: vi.fn(),
            triggerStep: vi.fn(),
            triggerStop: vi.fn(),
        };
        const builtActions = [{ execute: vi.fn(), id: 'save', keywords: 'save', label: 'Save' }];
        const filteredActions = [{ execute: vi.fn(), id: 'play', keywords: 'play', label: 'Play' }];

        const buildActions = vi.fn(() => builtActions);
        const filterActionsByQuery = vi.fn(() => filteredActions);

        const result = buildCommandPaletteFilteredActions(
            { actionDeps, query: 'pl' },
            { buildActions, filterActionsByQuery },
        );

        expect(buildActions).toHaveBeenCalledTimes(1);
        expect(buildActions).toHaveBeenCalledWith(actionDeps);
        expect(filterActionsByQuery).toHaveBeenCalledTimes(1);
        expect(filterActionsByQuery).toHaveBeenCalledWith(builtActions, 'pl');
        expect(result).toBe(filteredActions);
    });

    it('propagates empty query without mutating action deps', () => {
        const actionDeps = {
            activeFile: undefined,
            addRecentProject: vi.fn(),
            clearAllBreakpoints: vi.fn(),
            isPlaybackPaused: false,
            isRunning: false,
            markManualSave: vi.fn(),
            openGlobalSearchPopup: vi.fn(),
            openGlobalSearchReplacePopup: vi.fn(),
            openInitialProjectEntry: vi.fn(async () => {}),
            openProjectFromManifest: vi.fn(async () => {}),
            openSettingsModal: vi.fn(),
            recentProjects: undefined,
            resetDockLayout: vi.fn(),
            saveActiveFileFromCurrentScript: vi.fn(async () => {}),
            saveAllDirtyFiles: vi.fn(async () => {}),
            triggerPause: vi.fn(),
            triggerPlay: vi.fn(),
            triggerResume: vi.fn(),
            triggerStep: vi.fn(),
            triggerStop: vi.fn(),
        };
        const buildActions = vi.fn(() => []);
        const filterActionsByQuery = vi.fn(() => []);

        buildCommandPaletteFilteredActions(
            { actionDeps, query: '' },
            { buildActions, filterActionsByQuery },
        );

        expect(buildActions).toHaveBeenCalledWith(actionDeps);
        expect(filterActionsByQuery).toHaveBeenCalledWith([], '');
        expect(actionDeps.recentProjects).toBeUndefined();
    });
});

