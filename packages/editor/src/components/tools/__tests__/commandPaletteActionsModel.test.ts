import { describe, expect, it, vi } from 'vitest';

import {
    buildCommandPaletteActions,
    type CommandPaletteActionDeps,
    executeRecentProjectOpenSequence,
} from '../commandPaletteActionsModel';

function byId(actions: ReturnType<typeof buildCommandPaletteActions>, id: string) {
    return actions.find((action) => action.id === id);
}

function createDeps(overrides?: Partial<CommandPaletteActionDeps>): CommandPaletteActionDeps {
    return {
        activeDockLayoutPresetId: undefined,
        activeFile: '/project/scripts/intro.json',
        addRecentProject: vi.fn(),
        availableThemeKeys: ['classic', 'classic-light', 'custom-a'],
        captureDockLayoutJson: vi.fn(() => ({ global: { splitterSize: 4 }, layout: { children: [], type: 'row' } })),
        clearAllBreakpoints: vi.fn(),
        closeProject: vi.fn(),
        deleteDockLayoutPreset: vi.fn(),
        dockLayoutPresets: [],
        isPlaybackPaused: false,
        isRunning: false,
        markManualSave: vi.fn(),
        openExportGameModal: vi.fn(),
        openGlobalSearchPopup: vi.fn(),
        openGlobalSearchReplacePopup: vi.fn(),
        openInitialProjectEntry: vi.fn(async () => {}),
        openNewProjectModal: vi.fn(),
        openProjectFolder: vi.fn(async () => {}),
        openProjectFromManifest: vi.fn(async () => {}),
        openSettingsModal: vi.fn(),
        projectPath: '/project',
        recentProjects: [],
        resetDockLayout: vi.fn(),
        saveActiveFileFromCurrentScript: vi.fn(async () => {}),
        saveAllDirtyFiles: vi.fn(async () => {}),
        saveDockLayoutPreset: vi.fn(),
        saveProjectAs: vi.fn(async () => {}),
        setActiveDockLayoutPresetId: vi.fn(),
        setDockLayoutJson: vi.fn(),
        setThemeKey: vi.fn(),
        themeKey: 'classic',
        triggerPause: vi.fn(),
        triggerPlay: vi.fn(),
        triggerResume: vi.fn(),
        triggerStep: vi.fn(),
        triggerStop: vi.fn(),
        ...overrides,
    };
}

describe('commandPaletteActionsModel', () => {
    it('builds base actions first and appends recent-project actions', () => {
        const deps = createDeps({
            recentProjects: [
                { name: 'Alpha', path: '/alpha/game.json' },
                { name: 'Beta', path: '/beta/game.json' },
            ],
        });

        const actions = buildCommandPaletteActions(deps);

        expect(actions).toHaveLength(21);
        expect(actions[0]?.id).toBe('find-project');
        expect(actions[17]?.id).toBe('reset-layout');
        expect(actions[18]?.id).toBe('save-layout-preset');
        expect(actions[19]?.id).toBe('open-recent-/alpha/game.json');
        expect(actions[20]?.id).toBe('open-recent-/beta/game.json');
    });

    it('marks manual save before save and save-all actions', async () => {
        const deps = createDeps();
        const actions = buildCommandPaletteActions(deps);

        await byId(actions, 'save')?.action();
        await byId(actions, 'save-all')?.action();

        expect(deps.markManualSave).toHaveBeenCalledTimes(2);
        expect(deps.saveActiveFileFromCurrentScript).toHaveBeenCalledTimes(1);
        expect(deps.saveAllDirtyFiles).toHaveBeenCalledTimes(1);
    });

    it('skips save active file when there is no active file', async () => {
        const deps = createDeps({ activeFile: undefined });
        const actions = buildCommandPaletteActions(deps);

        await byId(actions, 'save')?.action();

        expect(deps.markManualSave).not.toHaveBeenCalled();
        expect(deps.saveActiveFileFromCurrentScript).not.toHaveBeenCalled();
    });

    it('guards pause, resume, and step actions by playback state', async () => {
        const pausedDeps = createDeps({ isPlaybackPaused: true, isRunning: true });
        const pausedActions = buildCommandPaletteActions(pausedDeps);

        await byId(pausedActions, 'playback-pause')?.action();
        await byId(pausedActions, 'playback-resume')?.action();
        await byId(pausedActions, 'playback-step')?.action();

        expect(pausedDeps.triggerPause).not.toHaveBeenCalled();
        expect(pausedDeps.triggerResume).toHaveBeenCalledTimes(1);
        expect(pausedDeps.triggerStep).toHaveBeenCalledTimes(1);

        const runningDeps = createDeps({ isPlaybackPaused: false, isRunning: true });
        const runningActions = buildCommandPaletteActions(runningDeps);

        await byId(runningActions, 'playback-pause')?.action();
        await byId(runningActions, 'playback-resume')?.action();
        await byId(runningActions, 'playback-step')?.action();

        expect(runningDeps.triggerPause).toHaveBeenCalledTimes(1);
        expect(runningDeps.triggerResume).not.toHaveBeenCalled();
        expect(runningDeps.triggerStep).not.toHaveBeenCalled();
    });

    it('opens recent projects with manifest open, recency update, then entry open', async () => {
        const calls: string[] = [];
        const deps = createDeps({
            addRecentProject: vi.fn(() => {
                calls.push('addRecentProject');
            }),
            openInitialProjectEntry: vi.fn(() => {
                calls.push('openInitialProjectEntry');
                return Promise.resolve();
            }),
            openProjectFromManifest: vi.fn(() => {
                calls.push('openProjectFromManifest');
                return Promise.resolve();
            }),
            recentProjects: [{ name: 'Alpha', path: '/alpha/game.json' }],
        });

        const actions = buildCommandPaletteActions(deps);
        await byId(actions, 'open-recent-/alpha/game.json')?.action();

        expect(calls).toEqual(['openProjectFromManifest', 'addRecentProject', 'openInitialProjectEntry']);
    });

    it('runs recent-project open sequence helper in order', async () => {
        const calls: string[] = [];
        const deps = {
            addRecentProject: (path: string) => {
                calls.push(`add:${path}`);
            },
            openInitialProjectEntry: () => {
                calls.push('openInitial');
                return Promise.resolve();
            },
            openProjectFromManifest: (path: string) => {
                calls.push(`open:${path}`);
                return Promise.resolve();
            },
        };

        await executeRecentProjectOpenSequence('/alpha/game.json', deps);

        expect(calls).toEqual(['open:/alpha/game.json', 'add:/alpha/game.json', 'openInitial']);
    });

    it('runs newly added file/workspace actions', async () => {
        const deps = createDeps();
        const actions = buildCommandPaletteActions(deps);

        await byId(actions, 'new-project')?.action();
        await byId(actions, 'save-project-as')?.action();
        await byId(actions, 'open-project-folder')?.action();
        await byId(actions, 'export-game')?.action();

        expect(deps.openNewProjectModal).toHaveBeenCalledTimes(1);
        expect(deps.saveProjectAs).toHaveBeenCalledTimes(1);
        expect(deps.openProjectFolder).toHaveBeenCalledTimes(1);
        expect(deps.openExportGameModal).toHaveBeenCalledTimes(1);
    });

    it('cycles theme key when toggle-theme runs', async () => {
        const deps = createDeps({ availableThemeKeys: ['classic', 'classic-light', 'custom-a'], themeKey: 'classic-light' });
        const actions = buildCommandPaletteActions(deps);

        await byId(actions, 'toggle-theme')?.action();

        expect(deps.setThemeKey).toHaveBeenCalledWith('custom-a');
    });

    it('saves, loads, and deletes layout presets', async () => {
        const deps = createDeps({
            activeDockLayoutPresetId: 'layout-a',
            dockLayoutPresets: [{ id: 'layout-a', layoutJson: { global: {}, layout: {} }, name: 'Layout A' }],
        });
        const promptMock = vi.fn(() => 'Court Layout');
        vi.stubGlobal('prompt', promptMock);

        const actions = buildCommandPaletteActions(deps);

        await byId(actions, 'save-layout-preset')?.action();
        await byId(actions, 'load-layout-layout-a')?.action();
        await byId(actions, 'delete-layout-layout-a')?.action();

        expect(promptMock).toHaveBeenCalledTimes(1);
        expect(deps.saveDockLayoutPreset).toHaveBeenCalledWith('Court Layout', { global: { splitterSize: 4 }, layout: { children: [], type: 'row' } });
        expect(deps.setDockLayoutJson).toHaveBeenCalledWith({ global: {}, layout: {} });
        expect(deps.setActiveDockLayoutPresetId).toHaveBeenCalledWith('layout-a');
        expect(deps.deleteDockLayoutPreset).toHaveBeenCalledWith('layout-a');

        vi.unstubAllGlobals();
    });
});

