import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkbenchTab } from '../../store/workbench/types';

const mocks = vi.hoisted(() => ({
    activeTabId: undefined as string | undefined,
    applyMacrosFile: vi.fn(),
    applyScriptFile: vi.fn(),
    readTextFile: vi.fn<(path: string) => Promise<string>>(),
    setTabSavedContent: vi.fn(),
    tabs: [] as WorkbenchTab[],
    updateTabContent: vi.fn(),
}));

vi.mock('../../store/useWorkbenchStore', () => ({
    useWorkbenchStore: { getState: () => ({
        ...mocks,
        setActiveTab: (tabId: string) => { mocks.activeTabId = tabId; },
    }) },
}));
vi.mock('../fs', () => ({ fsReadTextFile: mocks.readTextFile }));
vi.mock('../projectOpeners', () => ({
    applyAssetSelection: vi.fn(),
    applyMacrosFile: mocks.applyMacrosFile,
    applyScriptFile: mocks.applyScriptFile,
    looksLikeMacrosObject: (value: unknown) => !Array.isArray(value),
    looksLikeSceneFile: (value: unknown) => Array.isArray(value),
}));

import { activateWorkbenchTab } from '../activateWorkbenchTab';

describe('visual tab activation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.activeTabId = undefined;
        mocks.tabs = [];
    });

    it('restores a dirty visual draft without reading disk or replacing the saved snapshot', async () => {
        mocks.tabs = [{ dirty: true, id: 'intro', kind: 'script', path: '/intro.json', savedTextContent: '[]', textContent: '[{"type":"dialogue","text":"draft"}]', title: 'intro' }];
        await activateWorkbenchTab('intro');
        expect(mocks.readTextFile).not.toHaveBeenCalled();
        expect(mocks.setTabSavedContent).not.toHaveBeenCalled();
        expect(mocks.applyScriptFile).toHaveBeenCalledWith('/intro.json', [{ text: 'draft', type: 'dialogue' }]);
    });

    it('ignores a slow previous visual tab after a later activation completes', async () => {
        mocks.tabs = ['intro', 'next'].map(id => ({ id, kind: 'script', path: `/${id}.json`, title: id }));
        let finishIntro!: (text: string) => void;
        mocks.readTextFile.mockImplementation(path => path === '/intro.json'
            ? new Promise(resolve => { finishIntro = resolve; })
            : Promise.resolve('[{"type":"label","name":"next"}]'));
        const intro = activateWorkbenchTab('intro');
        await activateWorkbenchTab('next');
        finishIntro('[{"type":"label","name":"intro"}]');
        await intro;
        expect(mocks.applyScriptFile).toHaveBeenCalledTimes(1);
        expect(mocks.applyScriptFile).toHaveBeenCalledWith('/next.json', [{ name: 'next', type: 'label' }]);
        expect(mocks.setTabSavedContent).toHaveBeenCalledTimes(1);
        expect(mocks.activeTabId).toBe('next');
    });
});
