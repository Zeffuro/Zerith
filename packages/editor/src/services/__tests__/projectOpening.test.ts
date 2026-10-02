import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectSet, ProjectState } from '../../store/project/types';
import type { EditorNode } from '../../types/EditorNode';
import type { FsDirectoryEntry } from '../fs';

const mocks = vi.hoisted(() => ({
    readDirectory: vi.fn<(path: string) => Promise<FsDirectoryEntry[]>>(),
    readTextFile: vi.fn<(path: string) => Promise<string>>(),
}));
vi.mock('../fs', () => ({ fsReadDirectory: mocks.readDirectory, fsReadTextFile: mocks.readTextFile }));
vi.mock('../../store/useWorkbenchStore', () => ({ useWorkbenchStore: { getState: () => ({ tabs: [] }) } }));

import { createProjectIoSlice } from '../../store/project/slices/ioSlice';
import { createProjectManifestSlice } from '../../store/project/slices/manifestSlice';
import { createProjectSessionSlice } from '../../store/project/slices/sessionSlice';

function session() {
    let state = {} as ProjectState;
    let script: EditorNode[] = [{ text: 'Unsaved scene', type: 'dialogue' }];
    const published: ProjectState[] = [];
    const bridge = { getRootScript: () => script, setScript: vi.fn<(content: EditorNode[]) => void>(content => { script = content; }) };
    const set: ProjectSet = update => {
        state = { ...state, ...(typeof update === 'function' ? update(state) : update) };
        published.push(state);
    };
    const get = () => state;
    state = {
        ...state,
        ...createProjectSessionSlice(set, get, bridge),
        ...createProjectManifestSlice(set, get),
        ...createProjectIoSlice(get, bridge),
    };
    state.setProject('/current', [{ isDirectory: false, isFile: true, isSymlink: false, name: 'game.json' }]);
    state.setActiveFile('/current/intro.json', [{ text: 'Unsaved scene', type: 'dialogue' }]);
    state.markFileDirty('/current/intro.json');
    state = { ...state, macroEntries: [{ commands: [{ text: 'Unsaved macro', type: 'dialogue' }], name: 'greet' }], manifest: { title: 'Current' } };
    bridge.setScript.mockClear();
    published.length = 0;
    return { bridge, get, published, script: () => script };
}

describe('project opening session ownership', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.readDirectory.mockResolvedValue([{ isDirectory: false, isFile: true, isSymlink: false, name: 'game.json' }]);
        mocks.readTextFile.mockResolvedValue('{"title":"Next"}');
    });

    it.each([
        ['missing manifest', undefined],
        ['malformed JSON', '{'],
        ['null root', 'null'],
        ['array root', '[]'],
        ['missing characters', '{"characters":"characters.json"}'],
        ['missing items', '{"items":"items.json"}'],
        ['array characters', '{"characters":[]}'],
        ['scalar items', '{"items":7}'],
        ['missing scene', '{"scenes":{"intro":"intro.json"}}'],
        ['invalid macros', '{"macros":{"greet":null}}'],
    ])('retains the entire active session on %s', async (_label, manifest) => {
        const active = session();
        const before = active.get();
        mocks.readTextFile.mockImplementation(path => {
            if (path === '/next/game.json' && manifest !== undefined) return Promise.resolve(manifest);
            return Promise.reject(new Error(`Cannot read ${path}`));
        });
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            expect(await active.get().openProjectFromManifest('/next/game.json')).toBe(false);
            expect(active.get()).toBe(before);
            expect(active.script()).toEqual([{ text: 'Unsaved scene', type: 'dialogue' }]);
            expect(active.bridge.setScript).not.toHaveBeenCalled();
        } finally { error.mockRestore(); }
    });

    it.each(['characters', 'items'])('retains the current session for an invalid referenced %s root', async field => {
        const active = session();
        const before = active.get();
        mocks.readTextFile.mockImplementation(path => Promise.resolve(path.endsWith('/game.json') ? JSON.stringify({ [field]: 'invalid.json' }) : 'null'));
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            expect(await active.get().openProjectFromManifest('/next/game.json')).toBe(false);
            expect(active.get()).toBe(before);
            expect(active.bridge.setScript).not.toHaveBeenCalled();
        } finally { error.mockRestore(); }
    });

    it('retains the active session when directory listing fails', async () => {
        const active = session();
        const before = active.get();
        mocks.readDirectory.mockRejectedValue(new Error('Directory access denied'));
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            expect(await active.get().openProjectFromManifest('/next/game.json')).toBe(false);
            expect(active.get()).toBe(before);
        } finally { error.mockRestore(); }
    });

    it.each(['/game.json', 'F:/game.json', String.raw`F:\game.json`])('opens a manifest at a filesystem root: %s', async manifestPath => {
        const active = session();
        expect(await active.get().openProjectFromManifest(manifestPath)).toBe(true);
        const root = manifestPath.startsWith('/') ? '/' : 'F:/';
        expect(active.get().projectPath).toBe(root);
        expect(mocks.readDirectory).toHaveBeenCalledWith(root);
        expect(mocks.readTextFile).toHaveBeenCalledWith(`${root}game.json`);
    });

    it('does not activate an older open after the user closes the current project', async () => {
        const active = session();
        let finish!: (entries: []) => void;
        mocks.readDirectory.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
        const opening = active.get().openProjectFromManifest('/next/game.json');
        active.get().setProject(undefined, []);
        const closed = active.get();
        finish([]);
        expect(await opening).toBe(false);
        expect(active.get()).toBe(closed);
    });

    it('keeps the newer overlapping project when the older directory listing finishes last', async () => {
        const active = session();
        let finish!: (entries: []) => void;
        mocks.readDirectory.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
        const older = active.get().openProjectFromManifest('/older/game.json');
        expect(await active.get().openProjectFromManifest('/newer/game.json')).toBe(true);
        const newer = active.get();
        finish([]);
        expect(await older).toBe(false);
        expect(active.get()).toBe(newer);
    });

    it('installs all resolved data in the first state published for the new project', async () => {
        const active = session();
        mocks.readDirectory.mockResolvedValue([{ isDirectory: false, isFile: true, isSymlink: false, name: 'z.txt' }, { isDirectory: true, isFile: false, isSymlink: false, name: 'scenes' }, { isDirectory: false, isFile: true, isSymlink: false, name: 'game.json' }]);
        mocks.readTextFile.mockImplementation(path => Promise.resolve(JSON.stringify(path.endsWith('game.json')
            ? { scenes: { intro: 'scenes/intro.json' }, title: 'Loaded' }
            : [{ text: 'Loaded scene', type: 'dialogue' }])));
        const generation = active.get().projectGeneration;
        expect(await active.get().openProjectFromManifest('/next/game.json')).toBe(true);
        expect(active.published).toHaveLength(1);
        expect(active.published[0].manifest?.title).toBe('Loaded');
        expect(active.get()).toMatchObject({ dirtyFiles: new Set(), files: [{ isDirectory: true, isFile: false, isSymlink: false, name: 'scenes' }, { isDirectory: false, isFile: true, isSymlink: false, name: 'game.json' }, { isDirectory: false, isFile: true, isSymlink: false, name: 'z.txt' }], manifest: { title: 'Loaded' }, projectGeneration: generation + 1, projectPath: '/next', scenes: { intro: [{ text: 'Loaded scene', type: 'dialogue' }] } });
    });
});
