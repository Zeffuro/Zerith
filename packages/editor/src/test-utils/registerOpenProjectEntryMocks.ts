import type { GameManifest } from '@zeffuro/zerith-core';

import { vi } from 'vitest';

import type { WorkbenchTab } from '../store/workbench/types';

type OpenProjectState = {
    manifest: GameManifest | undefined;
    projectGeneration: number;
    projectPath: string | undefined;
};

const hoistedMocks = vi.hoisted(() => {
    const state: OpenProjectState = {
        manifest: undefined,
        projectGeneration: 1,
        projectPath: '/project',
    };

    return {
        applyAssetSelection: vi.fn(),
        applyMacrosFile: vi.fn(),
        applyScriptFile: vi.fn(),
        executeConsoleMessageAction: vi.fn(),
        executeWorkbenchOpenAction: vi.fn(),
        fsReadTextFile: vi.fn(() => Promise.resolve('')),
        getCurrentProjectPath: vi.fn(() => state.projectPath),
        getPreferredCharactersView: vi.fn((fallback?: 'json' | 'timeline') => fallback ?? 'json'),
        getPreferredEngineConfigView: vi.fn((fallback?: 'json' | 'timeline') => fallback ?? 'json'),
        getPreferredItemsView: vi.fn((fallback?: 'json' | 'timeline') => fallback ?? 'json'),
        getPreferredMacrosView: vi.fn((fallback?: 'json' | 'timeline') => fallback ?? 'timeline'),
        getPreferredManifestView: vi.fn((fallback?: 'json' | 'timeline') => fallback ?? 'json'),
        getPreferredScriptView: vi.fn((fallback?: 'json' | 'timeline') => fallback ?? 'timeline'),
        looksLikeMacrosObject: vi.fn((value: unknown) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)),
        looksLikeSceneFile: vi.fn((value: unknown) => Array.isArray(value) || (
            Boolean(value)
            && typeof value === 'object'
            && Array.isArray((value as { commands?: unknown }).commands)
        )),
        makeTabId: vi.fn((kind: string, path: string) => `${kind}:${path}`),
        state,
        tabs: [] as WorkbenchTab[],
    };
});

export function getOpenProjectEntryMocks() {
    return hoistedMocks;
}

export function resetOpenProjectEntryMocks(): void {
    hoistedMocks.applyAssetSelection.mockReset();
    hoistedMocks.applyMacrosFile.mockReset();
    hoistedMocks.applyScriptFile.mockReset();
    hoistedMocks.executeConsoleMessageAction.mockReset();
    hoistedMocks.executeWorkbenchOpenAction.mockReset();
    hoistedMocks.fsReadTextFile.mockReset();
    hoistedMocks.getCurrentProjectPath.mockReset();
    hoistedMocks.getPreferredCharactersView.mockReset();
    hoistedMocks.getPreferredEngineConfigView.mockReset();
    hoistedMocks.getPreferredItemsView.mockReset();
    hoistedMocks.getPreferredMacrosView.mockReset();
    hoistedMocks.getPreferredManifestView.mockReset();
    hoistedMocks.getPreferredScriptView.mockReset();
    hoistedMocks.looksLikeMacrosObject.mockReset();
    hoistedMocks.looksLikeSceneFile.mockReset();
    hoistedMocks.makeTabId.mockReset();

    hoistedMocks.state.manifest = undefined;
    hoistedMocks.state.projectGeneration = 1;
    hoistedMocks.state.projectPath = '/project';
    hoistedMocks.tabs = [];

    hoistedMocks.getCurrentProjectPath.mockImplementation(() => hoistedMocks.state.projectPath);
    hoistedMocks.getPreferredCharactersView.mockImplementation((fallback?: 'json' | 'timeline') => fallback ?? 'json');
    hoistedMocks.getPreferredEngineConfigView.mockImplementation((fallback?: 'json' | 'timeline') => fallback ?? 'json');
    hoistedMocks.getPreferredItemsView.mockImplementation((fallback?: 'json' | 'timeline') => fallback ?? 'json');
    hoistedMocks.getPreferredMacrosView.mockImplementation((fallback?: 'json' | 'timeline') => fallback ?? 'timeline');
    hoistedMocks.getPreferredManifestView.mockImplementation((fallback?: 'json' | 'timeline') => fallback ?? 'json');
    hoistedMocks.getPreferredScriptView.mockImplementation((fallback?: 'json' | 'timeline') => fallback ?? 'timeline');
    hoistedMocks.looksLikeMacrosObject.mockImplementation(
        (value: unknown) => Boolean(value) && typeof value === 'object' && !Array.isArray(value),
    );
    hoistedMocks.looksLikeSceneFile.mockImplementation((value: unknown) => Array.isArray(value) || (
        Boolean(value)
        && typeof value === 'object'
        && Array.isArray((value as { commands?: unknown }).commands)
    ));
    hoistedMocks.makeTabId.mockImplementation((kind: string, path: string) => `${kind}:${path}`);
}

export function setOpenProjectEntryState(next: Partial<OpenProjectState>): void {
    if (next.projectGeneration !== undefined) hoistedMocks.state.projectGeneration = next.projectGeneration;
    if (Object.hasOwn(next, 'manifest')) {
        hoistedMocks.state.manifest = next.manifest;
    }

    if (Object.hasOwn(next, 'projectPath')) {
        hoistedMocks.state.projectPath = next.projectPath;
    }
}

vi.mock('../store/actions/consoleMessageActions', () => ({
    executeConsoleMessageAction: hoistedMocks.executeConsoleMessageAction,
}));

vi.mock('../store/actions/projectTreeActions', () => ({
    getCurrentProjectPath: hoistedMocks.getCurrentProjectPath,
}));

vi.mock('../store/actions/workbenchOpenActions', () => ({
    executeWorkbenchOpenAction: hoistedMocks.executeWorkbenchOpenAction,
    getPreferredCharactersView: hoistedMocks.getPreferredCharactersView,
    getPreferredEngineConfigView: hoistedMocks.getPreferredEngineConfigView,
    getPreferredItemsView: hoistedMocks.getPreferredItemsView,
    getPreferredMacrosView: hoistedMocks.getPreferredMacrosView,
    getPreferredManifestView: hoistedMocks.getPreferredManifestView,
    getPreferredScriptView: hoistedMocks.getPreferredScriptView,
}));

vi.mock('../store/storeBootstrap', () => ({
    useProjectStore: {
        getState: () => hoistedMocks.state,
    },
}));

vi.mock('../store/useWorkbenchStore', () => ({
    makeTabId: hoistedMocks.makeTabId,
    useWorkbenchStore: { getState: () => ({ tabs: hoistedMocks.tabs }) },
}));

vi.mock('../services/fs', () => ({
    fsReadTextFile: hoistedMocks.fsReadTextFile,
}));

vi.mock('../services/projectOpeners', () => ({
    applyAssetSelection: hoistedMocks.applyAssetSelection,
    applyMacrosFile: hoistedMocks.applyMacrosFile,
    applyScriptFile: hoistedMocks.applyScriptFile,
    looksLikeMacrosObject: hoistedMocks.looksLikeMacrosObject,
    looksLikeSceneFile: hoistedMocks.looksLikeSceneFile,
}));
