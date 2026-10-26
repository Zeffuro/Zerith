import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkbenchTab } from '../../store/workbench/types';

const mocks = vi.hoisted(() => ({
    action: vi.fn(), generation: 1, open: vi.fn<() => Promise<void>>(), path: '/Game', selected: vi.fn(), tabs: [] as WorkbenchTab[],
}));
vi.mock('../../store/storeBootstrap', () => ({
    useProjectStore: { getState: () => ({ projectGeneration: mocks.generation, projectPath: mocks.path }) },
    useScriptStore: { getState: () => ({ setSelectedNodePath: mocks.selected }) },
}));
vi.mock('../../store/useEditorStore', () => ({ useEditorStore: { getState: () => ({ setSelectedNodePaths: mocks.selected, setSelectionAnchorPath: mocks.selected }) } }));
vi.mock('../../store/useWorkbenchStore', () => ({ useWorkbenchStore: { getState: () => ({ tabs: mocks.tabs }) } }));
vi.mock('../../store/actions/workbenchOpenActions', () => ({ executeWorkbenchOpenAction: mocks.action }));
vi.mock('../openProjectEntry', () => ({ openProjectEntry: mocks.open }));
vi.mock('../../store/project/projectPreparation', () => ({ resolveProjectFilePath: (root: string, path: string) => `${root}/${path}` }));

import { openStoryMapSource } from '../storyMap/storyMapNavigation';

function existing(kind: WorkbenchTab['kind'], textContent = '{"commands":[{"type":"jump","to":"dirty"}]}') {
    return { dirty: true, id: `${kind}:original`, kind, path: `${mocks.path}/scene.json`, savedTextContent: '[]', textContent, title: 'Keep title' };
}

describe('story map source draft identity', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.generation = 1; mocks.path = '/Game'; mocks.tabs = [];
        mocks.open.mockResolvedValue();
        vi.stubGlobal('dispatchEvent', vi.fn());
    });
    afterEach(() => vi.unstubAllGlobals());

    it.each([false, true])('uses the actual open script path for canonical aliases (native Windows: %s)', native => {
        if (native) { mocks.path = 'F:/Game'; vi.stubGlobal('__TAURI_INTERNALS__', {}); }
        const tab = existing('script');
        mocks.tabs = [tab];
        const filePath = native ? String.raw`f:\game\.\scene.json` : '/Game/./scene.json';
        return openStoryMapSource({ filePath, jsonPath: ['commands', 0], scriptPath: [0] }).then(() => {
            expect(mocks.open).toHaveBeenCalledWith(tab.path, 'scene.json', { forceView: 'timeline', jsonHintKind: 'script', jsonSelectionPath: ['commands', 0] });
            expect(mocks.action).not.toHaveBeenCalled();
            expect(mocks.selected).toHaveBeenCalledWith([0]);
            expect(tab.dirty).toBe(true);
        });
    });

    it.each(['json', 'macros', 'text', 'characters', 'engineConfig', 'items'] as const)('focuses the same dirty %s tab instead of reclassifying or rereading it', async kind => {
        const tab = existing(kind);
        mocks.tabs = [tab];
        await openStoryMapSource({ filePath: '/Game/./scene.json', jsonPath: ['commands', 0], scriptPath: [0] });
        expect(mocks.open).not.toHaveBeenCalled();
        expect(mocks.action.mock.calls.at(-1)).toEqual([{ action: 'openTab', tab: { ...tab, jsonSelectionPath: ['commands', 0], preferredView: 'json' } }]);
        expect(mocks.selected).not.toHaveBeenCalled();
        expect(mocks.tabs).toEqual([tab]);
    });

    it('focuses an invalid dirty manifest without parsing or replacing its draft', async () => {
        const tab = { ...existing('manifest', '{invalid'), path: '/Game/game.json' };
        mocks.tabs = [tab];
        await openStoryMapSource({ filePath: '/Game/game.json', jsonPath: ['scenes', 'intro', 0] });
        expect(mocks.open).not.toHaveBeenCalled();
        expect(mocks.action).toHaveBeenCalledWith({ action: 'setManifestView', view: 'json' });
        expect(mocks.action.mock.calls.at(-1)).toEqual([{ action: 'openTab', tab: { ...tab, jsonSelectionPath: ['scenes', 'intro', 0], preferredView: 'json' } }]);
    });

    it.each(['{bad', 'null', '{}', '[null]', '[{"type":"custom","commands":[null]}]',
        '[{"type":"custom","commands":'.repeat(2500) + '[]' + '}]'.repeat(2500)])('focuses unreadable dirty script JSON safely (case %#)', text => {
        const tab = existing('script', text);
        mocks.tabs = [tab];
        return openStoryMapSource({ filePath: tab.path, jsonPath: [], scriptPath: [] }).then(() => {
            expect(mocks.open).not.toHaveBeenCalled();
            expect(mocks.action).toHaveBeenCalledWith({ action: 'setScriptView', view: 'json' });
        });
    });

    it('does not apply a late script selection after the same project is reopened', async () => {
        let complete!: () => void;
        mocks.open.mockImplementation(() => new Promise<void>(resolve => { complete = resolve; }));
        const pending = openStoryMapSource({ filePath: '/Game/scene.json', scriptPath: [1] });
        mocks.generation++;
        complete();
        await pending;
        expect(mocks.selected).not.toHaveBeenCalled();
    });
});
