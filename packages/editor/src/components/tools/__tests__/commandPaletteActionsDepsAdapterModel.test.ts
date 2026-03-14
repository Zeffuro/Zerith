import { describe, expect, it, vi } from 'vitest';

import { buildCommandPaletteActionsDeps } from '../commandPaletteActionsDepsAdapterModel';

describe('commandPaletteActionsDepsAdapterModel', () => {
    it('maps all action dependency fields through without invoking handlers', () => {
        const depsArguments = {
            activeFile: '/project/scripts/intro.json',
            addRecentProject: vi.fn(),
            clearAllBreakpoints: vi.fn(),
            isPlaybackPaused: true,
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

        const deps = buildCommandPaletteActionsDeps(depsArguments);

        expect(deps).toStrictEqual(depsArguments);
        expect(deps.addRecentProject).toBe(depsArguments.addRecentProject);
        expect(deps.openInitialProjectEntry).toBe(depsArguments.openInitialProjectEntry);
        expect(deps.saveAllDirtyFiles).toBe(depsArguments.saveAllDirtyFiles);

        expect(depsArguments.addRecentProject).not.toHaveBeenCalled();
        expect(depsArguments.openInitialProjectEntry).not.toHaveBeenCalled();
        expect(depsArguments.saveAllDirtyFiles).not.toHaveBeenCalled();
    });

    it('preserves undefined optional-ish inputs like activeFile and recentProjects', () => {
        const deps = buildCommandPaletteActionsDeps({
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
        });

        expect(deps.activeFile).toBeUndefined();
        expect(deps.recentProjects).toBeUndefined();
    });
});

