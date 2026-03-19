import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EditorState } from '../types';

const settingsState = vi.hoisted(() => ({
    autosaveEnabled: true,
    autosaveIntervalMs: 12_000,
    isMuted: true,
    recentProjects: [{ lastOpened: 5, name: 'Seed Project', path: '/seed/game.json' }],
    setAutosaveEnabled: vi.fn<(value: boolean) => void>(),
    setAutosaveIntervalMs: vi.fn<(value: number) => void>(),
    setIsMuted: vi.fn<(value: boolean) => void>(),
    setRecentProjects: vi.fn<(value: EditorState['recentProjects']) => void>(),
    setThemeKey: vi.fn<(value: string) => void>(),
    setUiScale: vi.fn<(value: number) => void>(),
    setWindowState: vi.fn<(value: EditorState['windowState']) => void>(),
    themeKey: 'classicSoft',
    uiScale: 1.25,
    windowState: { height: 700, maximized: true, width: 1200, x: 10, y: 20 },
}));

vi.mock('../../useSettingsStore', () => ({
    useSettingsStore: {
        getState: () => settingsState,
    },
}));

import { createUiPrefsSlice } from '../slices/uiPrefsSlice';

function getRecentProjectsCall(index: number): EditorState['recentProjects'] {
    const next = settingsState.setRecentProjects.mock.calls[index]?.[0] as EditorState['recentProjects'] | undefined;
    if (!next) throw new TypeError(`Missing recentProjects call at index ${index}.`);
    return next;
}

function getSetRecentProjectsCall(setMock: ReturnType<typeof vi.fn>, index: number): EditorState['recentProjects'] {
    const partial = setMock.mock.calls[index]?.[0] as { recentProjects?: EditorState['recentProjects'] } | undefined;
    const next = partial?.recentProjects;
    if (!next) throw new TypeError(`Missing set recentProjects payload at index ${index}.`);
    return next;
}

describe('createUiPrefsSlice', () => {
    beforeEach(() => {
        settingsState.recentProjects = [{ lastOpened: 5, name: 'Seed Project', path: '/seed/game.json' }];
        settingsState.setAutosaveEnabled.mockReset();
        settingsState.setAutosaveIntervalMs.mockReset();
        settingsState.setIsMuted.mockReset();
        settingsState.setRecentProjects.mockReset();
        settingsState.setThemeKey.mockReset();
        settingsState.setUiScale.mockReset();
        settingsState.setWindowState.mockReset();
    });

    it('hydrates autosave and theme prefs from settings store', () => {
        const slice = createUiPrefsSlice(() => {});

        expect(slice.autosaveEnabled).toBe(true);
        expect(slice.autosaveIntervalMs).toBe(12_000);
        expect(slice.isMuted).toBe(true);
        expect(slice.recentProjects).toEqual([{ lastOpened: 5, name: 'Seed Project', path: '/seed/game.json' }]);
        expect(slice.themeKey).toBe('classicSoft');
        expect(slice.uiScale).toBe(1.25);
        expect(slice.windowState).toEqual({ height: 700, maximized: true, width: 1200, x: 10, y: 20 });
    });

    it('writes autosave updates through to settings store with clamped interval', () => {
        const set = vi.fn(
            (
                partial:
                    | ((state: EditorState) => Partial<EditorState>)
                    | Partial<EditorState>,
            ) => partial,
        );

        const slice = createUiPrefsSlice(set);
        slice.setAutosaveEnabled(false);
        slice.setAutosaveIntervalMs(1200.7);

        expect(settingsState.setAutosaveEnabled).toHaveBeenCalledWith(false);
        expect(settingsState.setAutosaveIntervalMs).toHaveBeenCalledWith(5000);
        expect(set).toHaveBeenNthCalledWith(1, { autosaveEnabled: false });
        expect(set).toHaveBeenNthCalledWith(2, { autosaveIntervalMs: 5000 });
    });

    it('writes theme and uiScale updates through to settings store', () => {
        const set = vi.fn(
            (
                partial:
                    | ((state: EditorState) => Partial<EditorState>)
                    | Partial<EditorState>,
            ) => partial,
        );

        const slice = createUiPrefsSlice(set);
        slice.setThemeKey('classic');
        slice.setUiScale(1.5);

        expect(settingsState.setThemeKey).toHaveBeenNthCalledWith(1, 'classic');
        expect(settingsState.setUiScale).toHaveBeenNthCalledWith(1, 1.5);
        expect(set).toHaveBeenNthCalledWith(1, { themeKey: 'classic' });
        expect(set).toHaveBeenNthCalledWith(2, { uiScale: 1.5 });
    });

    it('writes windowState updates through to settings store', () => {
        const set = vi.fn(
            (
                partial:
                    | ((state: EditorState) => Partial<EditorState>)
                    | Partial<EditorState>,
            ) => partial,
        );

        const slice = createUiPrefsSlice(set);
        const nextWindowState = { height: 720, maximized: false, width: 1280, x: 12, y: 30 };
        slice.setWindowState(nextWindowState);

        expect(settingsState.setWindowState).toHaveBeenCalledWith(nextWindowState);
        expect(set).toHaveBeenCalledWith({ windowState: nextWindowState });
    });

    it('writes recent project updates through to settings store', () => {
        const set = vi.fn(
            (
                partial:
                    | ((state: EditorState) => Partial<EditorState>)
                    | Partial<EditorState>,
            ) => partial,
        );

        const slice = createUiPrefsSlice(set);
        slice.addRecentProject('/project/game.json');
        slice.clearRecentProjects();

        const firstSettingsRecentProjects = getRecentProjectsCall(0);
        expect(firstSettingsRecentProjects[0]).toMatchObject({ name: 'project', path: '/project/game.json' });
        expect(typeof firstSettingsRecentProjects[0]?.lastOpened).toBe('number');
        expect(firstSettingsRecentProjects[1]).toEqual({ lastOpened: 5, name: 'Seed Project', path: '/seed/game.json' });

        const firstSetRecentProjects = getSetRecentProjectsCall(set, 0);
        expect(firstSetRecentProjects[0]).toMatchObject({ name: 'project', path: '/project/game.json' });
        expect(typeof firstSetRecentProjects[0]?.lastOpened).toBe('number');
        expect(firstSetRecentProjects[1]).toEqual({ lastOpened: 5, name: 'Seed Project', path: '/seed/game.json' });

        expect(settingsState.setRecentProjects).toHaveBeenNthCalledWith(2, []);
        expect(set).toHaveBeenNthCalledWith(2, { recentProjects: [] });
    });

    it('ignores blank recent project paths', () => {
        const set = vi.fn();
        const slice = createUiPrefsSlice(set as never);

        slice.addRecentProject('   ');

        expect(settingsState.setRecentProjects).not.toHaveBeenCalled();
        expect(set).not.toHaveBeenCalled();
    });

    it('keeps the newest entry when adding a duplicate recent project path', () => {
        settingsState.recentProjects = [
            { lastOpened: 1, name: 'Old', path: '/project/game.json' },
            { lastOpened: 2, name: 'Other', path: '/other/game.json' },
        ];
        const set = vi.fn();
        const slice = createUiPrefsSlice(set as never);

        slice.addRecentProject('/project/game.json');

        expect(settingsState.setRecentProjects).toHaveBeenCalledTimes(1);
        const next = getRecentProjectsCall(0);
        expect(next[0]).toMatchObject({ name: 'project', path: '/project/game.json' });
        expect(typeof next[0]?.lastOpened).toBe('number');
        expect(next[1]).toEqual({ lastOpened: 2, name: 'Other', path: '/other/game.json' });
    });

    it('caps recent projects to 12 entries', () => {
        settingsState.recentProjects = Array.from({ length: 12 }, (_, index) => ({
            lastOpened: 100 - index,
            name: `P${index}`,
            path: `/p${index}/game.json`,
        }));
        const set = vi.fn();
        const slice = createUiPrefsSlice(set as never);

        slice.addRecentProject('/new/game.json');

        const next = getRecentProjectsCall(0);
        expect(next).toHaveLength(12);
        expect(next[0]).toMatchObject({ name: 'new', path: '/new/game.json' });
    });

    it('infers project name from Windows-style paths', () => {
        const set = vi.fn();
        const slice = createUiPrefsSlice(set as never);

        slice.addRecentProject(String.raw`C:\Games\CaseOne\game.json`);

        const next = getRecentProjectsCall(0);
        expect(next[0]).toMatchObject({ name: 'CaseOne', path: String.raw`C:\Games\CaseOne\game.json` });
    });

    it('writes mute toggles through to settings store', () => {
        const set = vi.fn(
            (
                partial:
                    | ((state: EditorState) => Partial<EditorState>)
                    | Partial<EditorState>,
            ) => partial,
        );

        const slice = createUiPrefsSlice(set);
        slice.toggleMute();

        expect(set).toHaveBeenCalledTimes(1);
        const updater = set.mock.calls[0]?.[0];
        expect(typeof updater).toBe('function');
        if (typeof updater !== 'function') throw new TypeError('Expected state updater function for toggleMute.');

        const next = updater({ isMuted: false } as EditorState);
        expect(settingsState.setIsMuted).toHaveBeenCalledWith(true);
        expect(next).toEqual({ isMuted: true });
    });

    it('opens and closes settings modal through direct actions', () => {
        const set = vi.fn();
        const slice = createUiPrefsSlice(set as never);

        slice.openSettingsModal();
        slice.closeSettingsModal();

        expect(set).toHaveBeenNthCalledWith(1, { isGlobalSearchPopupOpen: false, isSettingsModalOpen: true });
        expect(set).toHaveBeenNthCalledWith(2, { isSettingsModalOpen: false });
    });

    it('opens and closes export modal through direct actions', () => {
        const set = vi.fn();
        const slice = createUiPrefsSlice(set as never);

        slice.openExportGameModal();
        slice.closeExportGameModal();

        expect(set).toHaveBeenNthCalledWith(1, { isExportGameModalOpen: true });
        expect(set).toHaveBeenNthCalledWith(2, { isExportGameModalOpen: false });
    });

    it('opens and closes new project modal through direct actions', () => {
        const set = vi.fn();
        const slice = createUiPrefsSlice(set as never);

        slice.openNewProjectModal();
        slice.closeNewProjectModal();

        expect(set).toHaveBeenNthCalledWith(1, { isNewProjectModalOpen: true });
        expect(set).toHaveBeenNthCalledWith(2, { isNewProjectModalOpen: false });
    });

    it('toggles settings modal visibility with a state updater', () => {
        const set = vi.fn(
            (
                partial:
                    | ((state: EditorState) => Partial<EditorState>)
                    | Partial<EditorState>,
            ) => partial,
        );

        const slice = createUiPrefsSlice(set);
        slice.toggleSettingsModal();

        expect(set).toHaveBeenCalledTimes(1);
        const updater = set.mock.calls[0]?.[0];
        expect(typeof updater).toBe('function');
        if (typeof updater !== 'function') throw new TypeError('Expected state updater function for toggleSettingsModal.');

        const next = updater({ isSettingsModalOpen: false } as EditorState);
        expect(next).toEqual({ isSettingsModalOpen: true });
    });

    it('does not open global search popups while settings modal is open', () => {
        const set = vi.fn(
            (
                partial:
                    | ((state: EditorState) => Partial<EditorState>)
                    | Partial<EditorState>,
            ) => partial,
        );

        const slice = createUiPrefsSlice(set);
        slice.openGlobalSearchPopup('find');
        slice.openGlobalSearchReplacePopup();
        slice.toggleGlobalSearchPopup();

        const firstUpdater = set.mock.calls[0]?.[0];
        const secondUpdater = set.mock.calls[1]?.[0];
        const thirdUpdater = set.mock.calls[2]?.[0];
        if (typeof firstUpdater !== 'function' || typeof secondUpdater !== 'function' || typeof thirdUpdater !== 'function') {
            throw new TypeError('Expected state updater functions for guarded global search actions.');
        }

        const guardedState = { isGlobalSearchPopupOpen: false, isSettingsModalOpen: true } as EditorState;
        expect(firstUpdater(guardedState)).toEqual({});
        expect(secondUpdater(guardedState)).toEqual({});
        expect(thirdUpdater(guardedState)).toEqual({});
    });

    it('closes global search when opening settings', () => {
        const set = vi.fn();
        const slice = createUiPrefsSlice(set as never);

        slice.openSettingsModal();

        expect(set).toHaveBeenCalledWith({ isGlobalSearchPopupOpen: false, isSettingsModalOpen: true });
    });
});

