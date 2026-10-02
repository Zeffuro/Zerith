import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectSet, ProjectState } from '../../store/project/types';

const mocks = vi.hoisted(() => ({ readTextFile: vi.fn<(path: string) => Promise<string>>() }));
vi.mock('../fs', () => ({ fsReadTextFile: mocks.readTextFile }));

import { createProjectManifestSlice } from '../../store/project/slices/manifestSlice';
import { localizeSceneMapForPreview } from '../localizationPreview';

describe('manifest loading ownership', () => {
    beforeEach(() => vi.clearAllMocks());

    it('does not install a manifest from an older project session after reopening its path', async () => {
        const state = { dirtyFiles: new Set<string>(), localePaths: {}, locales: {}, projectGeneration: 1, projectPath: '/A', sceneNamespaces: {}, scenePaths: {}, scenes: {} };
        const set = vi.fn();
        const slice = createProjectManifestSlice(set, () => state as ProjectState);
        let complete!: (text: string) => void;
        mocks.readTextFile.mockReturnValueOnce(new Promise((resolve) => { complete = resolve; }));
        const loading = slice.loadManifest();
        state.projectGeneration = 3;
        complete('{"title":"old session"}');
        await loading;
        expect(set).not.toHaveBeenCalled();
    });

    it('keeps the newest overlapping reload when an earlier read completes last', async () => {
        const state = { dirtyFiles: new Set<string>(), localePaths: {}, locales: {}, projectGeneration: 1, projectPath: '/A', sceneNamespaces: {}, scenePaths: {}, scenes: {} };
        const set = vi.fn();
        const slice = createProjectManifestSlice(set, () => state as ProjectState);
        let complete!: (text: string) => void;
        mocks.readTextFile.mockReturnValueOnce(new Promise((resolve) => { complete = resolve; }));
        mocks.readTextFile.mockResolvedValueOnce('{"title":"new revision"}');
        const older = slice.loadManifest();
        await slice.loadManifest();
        complete('{"title":"old revision"}');
        await older;
        expect(set).toHaveBeenCalledTimes(1);
        expect(set).toHaveBeenCalledWith(expect.objectContaining({ manifest: { title: 'new revision' } }));
    });

    it('reloads committed files while retaining models whose source files have unsaved edits', async () => {
        const edited = [{ name: 'unsaved', type: 'label' }];
        const state = {
            characters: { hero: { displayName: 'Unsaved hero' } },
            dirtyFiles: new Set(['/A/data/characters.json', '/A/scenes/intro.json']),
            localePaths: {}, locales: {}, projectGeneration: 1, projectPath: '/A',
            sceneNamespaces: { intro: 'edited' }, scenePaths: { intro: '/A/scenes/intro.json' }, scenes: { intro: edited },
        };
        const set = vi.fn();
        const slice = createProjectManifestSlice(set, () => state as unknown as ProjectState);
        mocks.readTextFile.mockResolvedValueOnce('{"characters":"/data/characters.json","scenes":{"intro":"/scenes/intro.json","other":[]}}');
        mocks.readTextFile.mockResolvedValueOnce('{}');
        mocks.readTextFile.mockResolvedValueOnce('[]');
        await slice.loadManifest();
        expect(set).toHaveBeenCalledWith(expect.objectContaining({ characters: state.characters, scenes: { intro: edited, other: [] } }));
    });

    it.each(['file', 'inline'])('loads %s macro command arrays for localized preview while excluding reserved metadata', async (storage) => {
        const macros = {
            $custom: { owner: 'author' },
            $schema: 'zerith/macros',
            $tags: ['custom metadata'],
            greeting: [{ lineId: 'greet.001', text: 'Source greeting', type: 'dialogue' }],
        };
        const locale = { locale: 'fr', namespaces: { 'scene.greeting': { 'greet.001': 'Bonjour' } } };
        const manifest = {
            localization: { defaultLocale: 'fr', locales: { fr: locale } },
            macros: storage === 'file' ? '/data/macros.json' : macros,
        };
        const state = { dirtyFiles: new Set<string>(), localePaths: {}, locales: {}, macros: {}, projectGeneration: 1, projectPath: '/A', sceneNamespaces: {}, scenePaths: {}, scenes: {} } as unknown as ProjectState;
        const set = vi.fn<ProjectSet>((update) => {
            Object.assign(state, typeof update === 'function' ? update(state) : update);
        });
        const slice = createProjectManifestSlice(set, () => state);
        mocks.readTextFile.mockImplementation(path => Promise.resolve(JSON.stringify(path.endsWith('/game.json') ? manifest : macros)));
        await slice.loadManifest();
        expect(set).toHaveBeenCalledOnce();
        expect(state.macros).toEqual({ greeting: macros.greeting });
        expect(localizeSceneMapForPreview(state.macros, {}, state.locales.fr)).toEqual({
            greeting: [{ lineId: 'greet.001', text: 'Bonjour', type: 'dialogue' }],
        });
        expect(state.macros.greeting[0].text).toBe('Source greeting');
    });
});
