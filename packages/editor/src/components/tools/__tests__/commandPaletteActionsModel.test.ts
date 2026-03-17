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
        activeFile: '/project/scripts/intro.json',
        addRecentProject: vi.fn(),
        closeProject: vi.fn(),
        clearAllBreakpoints: vi.fn(),
        isPlaybackPaused: false,
        isRunning: false,
        markManualSave: vi.fn(),
        openGlobalSearchPopup: vi.fn(),
        openGlobalSearchReplacePopup: vi.fn(),
        openInitialProjectEntry: vi.fn(async () => {}),
        openProjectFromManifest: vi.fn(async () => {}),
        openSettingsModal: vi.fn(),
        recentProjects: [],
        resetDockLayout: vi.fn(),
        saveActiveFileFromCurrentScript: vi.fn(async () => {}),
        saveAllDirtyFiles: vi.fn(async () => {}),
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

        expect(actions).toHaveLength(15);
        expect(actions[0]?.id).toBe('find-project');
        expect(actions[12]?.id).toBe('reset-layout');
        expect(actions[13]?.id).toBe('open-recent-/alpha/game.json');
        expect(actions[14]?.id).toBe('open-recent-/beta/game.json');
    });

    it('marks manual save before save and save-all actions', async () => {
        const deps = createDeps();
        const actions = buildCommandPaletteActions(deps);

        await byId(actions, 'save')?.execute();
        await byId(actions, 'save-all')?.execute();

        expect(deps.markManualSave).toHaveBeenCalledTimes(2);
        expect(deps.saveActiveFileFromCurrentScript).toHaveBeenCalledTimes(1);
        expect(deps.saveAllDirtyFiles).toHaveBeenCalledTimes(1);
    });

    it('skips save active file when there is no active file', async () => {
        const deps = createDeps({ activeFile: undefined });
        const actions = buildCommandPaletteActions(deps);

        await byId(actions, 'save')?.execute();

        expect(deps.markManualSave).not.toHaveBeenCalled();
        expect(deps.saveActiveFileFromCurrentScript).not.toHaveBeenCalled();
    });

    it('guards pause, resume, and step actions by playback state', async () => {
        const pausedDeps = createDeps({ isPlaybackPaused: true, isRunning: true });
        const pausedActions = buildCommandPaletteActions(pausedDeps);

        await byId(pausedActions, 'playback-pause')?.execute();
        await byId(pausedActions, 'playback-resume')?.execute();
        await byId(pausedActions, 'playback-step')?.execute();

        expect(pausedDeps.triggerPause).not.toHaveBeenCalled();
        expect(pausedDeps.triggerResume).toHaveBeenCalledTimes(1);
        expect(pausedDeps.triggerStep).toHaveBeenCalledTimes(1);

        const runningDeps = createDeps({ isPlaybackPaused: false, isRunning: true });
        const runningActions = buildCommandPaletteActions(runningDeps);

        await byId(runningActions, 'playback-pause')?.execute();
        await byId(runningActions, 'playback-resume')?.execute();
        await byId(runningActions, 'playback-step')?.execute();

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
        await byId(actions, 'open-recent-/alpha/game.json')?.execute();

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
});

