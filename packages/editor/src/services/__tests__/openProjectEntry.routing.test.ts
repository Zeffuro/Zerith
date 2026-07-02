import type { GameManifest } from '@zeffuro/zerith-core';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    getOpenProjectEntryMocks,
    resetOpenProjectEntryMocks,
    setOpenProjectEntryState,
} from '../../test-utils/registerOpenProjectEntryMocks';
import {
    basenameFromPath,
    getPreferredViewForJsonResource,
    getViewActionForJsonResource,
    isManifestFilePath,
    normalizeFilePath,
    openProjectEntry,
    resolveJsonKindFromManifest,
    resolveJsonKindFromSchema,
    routeJsonEntry,
    setMissingSpritesheetDescriptorHandler,
    toProjectRelativePath,
} from '../openProjectEntry';

const openProjectEntryMocks = getOpenProjectEntryMocks();
const looksLikeMacros = (value: unknown) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

describe('openProjectEntry jsonRouting', () => {
    it('prioritizes hinted resource kinds', () => {
        expect(routeJsonEntry({
            data: [],
            filePath: '/project/scripts/intro.json',
            hintedKind: 'manifest',
            isMacrosObject: looksLikeMacros,
        })).toEqual({ kind: 'resource', resourceKind: 'manifest' });

        expect(routeJsonEntry({
            data: {},
            filePath: '/project/data/items.json',
            hintedKind: 'items',
            isMacrosObject: looksLikeMacros,
        })).toEqual({ kind: 'resource', resourceKind: 'items' });

        expect(routeJsonEntry({
            data: {},
            filePath: '/project/data/characters.json',
            hintedKind: 'characters',
            isMacrosObject: looksLikeMacros,
        })).toEqual({ kind: 'resource', resourceKind: 'characters' });

        expect(routeJsonEntry({
            data: {},
            filePath: '/project/engine.config.json',
            hintedKind: 'engineConfig',
            isMacrosObject: looksLikeMacros,
        })).toEqual({ kind: 'resource', resourceKind: 'engineConfig' });
    });

    it('routes hinted script/macros before heuristics', () => {
        expect(routeJsonEntry({
            data: {},
            filePath: '/project/scripts/intro.json',
            hintedKind: 'script',
            isMacrosObject: looksLikeMacros,
        })).toEqual({ kind: 'script', requiresArrayShape: true });

        expect(routeJsonEntry({
            data: [],
            filePath: '/project/data/macros.json',
            hintedKind: 'macros',
            isMacrosObject: looksLikeMacros,
        })).toEqual({ kind: 'macros', requiresObjectShape: true });
    });

    it('falls back to array/macros heuristics when no hint is present', () => {
        expect(routeJsonEntry({
            data: [{ type: 'wait' }],
            filePath: '/project/scripts/freeform.json',
            hintedKind: undefined,
            isMacrosObject: looksLikeMacros,
        })).toEqual({ kind: 'script', requiresArrayShape: false });

        expect(routeJsonEntry({
            data: { greet: [] },
            filePath: '/project/scripts/freeform_macros.json',
            hintedKind: undefined,
            isMacrosObject: looksLikeMacros,
        })).toEqual({ kind: 'macros', requiresObjectShape: false });
    });

    it('uses manifest/json fallback based on file name when no route matches', () => {
        expect(routeJsonEntry({
            data: 1,
            filePath: '/project/game.json',
            hintedKind: undefined,
            isMacrosObject: looksLikeMacros,
        })).toEqual({ kind: 'unknownJson', tabKind: 'manifest' });

        expect(routeJsonEntry({
            data: 1,
            filePath: '/project/data/custom.json',
            hintedKind: undefined,
            isMacrosObject: looksLikeMacros,
        })).toEqual({ kind: 'unknownJson', tabKind: 'json' });
    });
});

describe('openProjectEntry jsonKindResolution', () => {
    describe('resolveJsonKindFromSchema', () => {
        it('maps known schema ids to JSON kinds', () => {
            expect(resolveJsonKindFromSchema({ $schema: 'zerith/manifest' })).toBe('manifest');
            expect(resolveJsonKindFromSchema({ $schema: 'zerith/characters' })).toBe('characters');
            expect(resolveJsonKindFromSchema({ $schema: 'zerith/engine-config' })).toBe('engineConfig');
            expect(resolveJsonKindFromSchema({ $schema: 'zerith/items' })).toBe('items');
            expect(resolveJsonKindFromSchema({ $schema: 'zerith/macros' })).toBe('macros');
            expect(resolveJsonKindFromSchema({ $schema: 'zerith/scene' })).toBe('script');
        });

        it('returns undefined for unknown or missing schema ids', () => {
            expect(resolveJsonKindFromSchema({})).toBeUndefined();
            expect(resolveJsonKindFromSchema({ $schema: 'zerith/unknown' })).toBeUndefined();
            expect(resolveJsonKindFromSchema([])).toBeUndefined();
        });
    });

    describe('resolveJsonKindFromManifest', () => {
        it('detects manifest from game.json path without manifest state', () => {
            expect(resolveJsonKindFromManifest('/project/game.json', undefined, '/project')).toBe('manifest');
        });

        it('detects engine config from engine.config.json path without manifest state', () => {
            expect(resolveJsonKindFromManifest('/project/engine.config.json', undefined, '/project')).toBe('engineConfig');
        });

        it('resolves characters and scenes using manifest-relative paths', () => {
            const manifest = {
                characters: 'data/characters.json',
                scenes: {
                    intro: 'scripts/intro.json',
                },
            } as unknown as GameManifest;

            expect(resolveJsonKindFromManifest('/project/data/characters.json', manifest, '/project')).toBe('characters');
            expect(resolveJsonKindFromManifest('/project/scripts/intro.json', manifest, '/project')).toBe('script');
        });

        it('normalizes windows separators when matching manifest paths', () => {
            const manifest = {
                macros: 'scripts/macros.json',
            } as unknown as GameManifest;

            expect(resolveJsonKindFromManifest(String.raw`C:\project\scripts\macros.json`, manifest, String.raw`C:\project`)).toBe('macros');
        });
    });
});

describe('openProjectEntry viewPrefs', () => {
    beforeEach(() => {
        resetOpenProjectEntryMocks();
    });

    it('maps resource kinds to preferred view selectors', () => {
        expect(getPreferredViewForJsonResource('manifest', 'timeline')).toBe('timeline');
        expect(getPreferredViewForJsonResource('engineConfig', 'timeline')).toBe('timeline');
        expect(getPreferredViewForJsonResource('items', 'timeline')).toBe('timeline');
        expect(getPreferredViewForJsonResource('characters', 'json')).toBe('json');

        expect(openProjectEntryMocks.getPreferredManifestView).toHaveBeenCalledWith('timeline');
        expect(openProjectEntryMocks.getPreferredEngineConfigView).toHaveBeenCalledWith('timeline');
        expect(openProjectEntryMocks.getPreferredItemsView).toHaveBeenCalledWith('timeline');
        expect(openProjectEntryMocks.getPreferredCharactersView).toHaveBeenCalledWith('json');
    });

    it('maps resource kinds to view action names', () => {
        expect(getViewActionForJsonResource('manifest')).toBe('setManifestView');
        expect(getViewActionForJsonResource('engineConfig')).toBe('setEngineConfigView');
        expect(getViewActionForJsonResource('items')).toBe('setItemsView');
        expect(getViewActionForJsonResource('characters')).toBe('setCharactersView');
    });
});

describe('openProjectEntry pathHelpers', () => {
    it('normalizes windows separators to forward slashes', () => {
        expect(normalizeFilePath(String.raw`C:\project\scripts\intro.json`)).toBe('C:/project/scripts/intro.json');
    });

    it('extracts basename for both slash styles', () => {
        expect(basenameFromPath('/project/scripts/intro.json')).toBe('intro.json');
        expect(basenameFromPath(String.raw`C:\project\scripts\intro.json`)).toBe('intro.json');
        expect(basenameFromPath('game.json')).toBe('game.json');
    });

    it('detects manifest file names case-insensitively', () => {
        expect(isManifestFilePath('/project/game.json')).toBe(true);
        expect(isManifestFilePath(String.raw`C:\project\GAME.JSON`)).toBe(true);
        expect(isManifestFilePath('/project/data/items.json')).toBe(false);
    });

    it('returns project-relative slash path for in-project files', () => {
        expect(toProjectRelativePath('/project/assets/bg/courtroom.png', '/project')).toBe('/assets/bg/courtroom.png');
        expect(toProjectRelativePath('/project/scripts/intro.json', '/project/')).toBe('/scripts/intro.json');
    });

    it('returns original path for files outside the project root', () => {
        expect(toProjectRelativePath('/other/scripts/intro.json', '/project')).toBe('/other/scripts/intro.json');
    });
});

describe('openProjectEntry', () => {
    beforeEach(() => {
        resetOpenProjectEntryMocks();
        setMissingSpritesheetDescriptorHandler(undefined);
    });

    it('opens engine.config.json using engineConfig route and applies forced view', async () => {
        openProjectEntryMocks.fsReadTextFile.mockResolvedValueOnce('{"display":{"width":1280}}');

        await openProjectEntry('/project/engine.config.json', 'engine.config.json', { forceView: 'json' });

        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenNthCalledWith(1, {
            action: 'setEngineConfigView',
            view: 'json',
        });
        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenNthCalledWith(2, {
            action: 'openTab',
            tab: {
                id: 'engineConfig:/project/engine.config.json',
                kind: 'engineConfig',
                path: '/project/engine.config.json',
                preferredView: 'json',
                textContent: '{"display":{"width":1280}}',
                title: 'Engine Config',
            },
        });
    });


    it('opens image assets in an asset tab and updates selection', async () => {
        openProjectEntryMocks.fsReadTextFile.mockRejectedValueOnce(new Error('missing descriptor'));

        await openProjectEntry('/project/assets/bg/courtroom.png', 'courtroom.png');

        expect(openProjectEntryMocks.applyAssetSelection).toHaveBeenCalledWith('/assets/bg/courtroom.png');
        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenCalledWith({
            action: 'openTab',
            tab: {
                assetPath: '/assets/bg/courtroom.png',
                id: 'asset:/project/assets/bg/courtroom.png',
                kind: 'asset',
                path: '/project/assets/bg/courtroom.png',
                title: 'courtroom.png',
            },
        });
    });

    it('opens svg image assets in an asset tab and updates selection', async () => {
        openProjectEntryMocks.fsReadTextFile.mockRejectedValueOnce(new Error('missing descriptor'));

        await openProjectEntry('/project/assets/sprites/aria-smile.svg', 'aria-smile.svg');

        expect(openProjectEntryMocks.applyAssetSelection).toHaveBeenCalledWith('/assets/sprites/aria-smile.svg');
        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenCalledWith({
            action: 'openTab',
            tab: {
                assetPath: '/assets/sprites/aria-smile.svg',
                id: 'asset:/project/assets/sprites/aria-smile.svg',
                kind: 'asset',
                path: '/project/assets/sprites/aria-smile.svg',
                title: 'aria-smile.svg',
            },
        });
    });

    it('opens .sheet.json files as spritesheet tabs when descriptor payload is spritesheet-shaped', async () => {
        const descriptor = '{"format":"atlas","source":"hero.png","frames":{}}';
        openProjectEntryMocks.fsReadTextFile
            .mockResolvedValueOnce(descriptor)
            .mockResolvedValueOnce(descriptor);

        await openProjectEntry('/project/assets/sprites/hero.sheet.json', 'hero.sheet.json');

        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenCalledWith({
            action: 'openTab',
            tab: {
                id: 'spritesheet:/project/assets/sprites/hero.sheet.json',
                kind: 'spritesheet',
                path: '/project/assets/sprites/hero.sheet.json',
                textContent: descriptor,
                title: 'hero.sheet.json',
            },
        });
    });

    it('routes legacy .atlas.json descriptors through standard JSON heuristics', async () => {
        const descriptor = '{"format":"atlas","source":"hero.png","frames":{}}';
        openProjectEntryMocks.fsReadTextFile.mockResolvedValueOnce(descriptor);

        await openProjectEntry('/project/assets/sprites/hero.atlas.json', 'hero.atlas.json');

        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenCalledWith({
            action: 'openTab',
            tab: {
                id: 'macros:/project/assets/sprites/hero.atlas.json',
                kind: 'macros',
                path: '/project/assets/sprites/hero.atlas.json',
                preferredView: 'timeline',
                title: 'hero.atlas.json',
            },
        });
    });

    it('opens .sheet.json files as audiosheet tabs when descriptor payload is audiosheet-shaped', async () => {
        const descriptor = '{"source":"blip.wav","cues":{}}';
        openProjectEntryMocks.fsReadTextFile
            .mockResolvedValueOnce(descriptor)
            .mockResolvedValueOnce(descriptor);

        await openProjectEntry('/project/assets/sfx/blip.sheet.json', 'blip.sheet.json');

        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenCalledWith({
            action: 'openTab',
            tab: {
                id: 'audiosheet:/project/assets/sfx/blip.sheet.json',
                kind: 'audiosheet',
                path: '/project/assets/sfx/blip.sheet.json',
                textContent: descriptor,
                title: 'blip.sheet.json',
            },
        });
    });

    it('opens image entries in spritesheet editor when a companion descriptor exists', async () => {
        const descriptor = '{"format":"atlas","source":"hero.png","frames":{}}';
        openProjectEntryMocks.fsReadTextFile
            .mockResolvedValueOnce(descriptor)
            .mockResolvedValueOnce(descriptor);

        await openProjectEntry('/project/assets/sprites/hero.png', 'hero.png');

        expect(openProjectEntryMocks.applyAssetSelection).not.toHaveBeenCalled();
        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenCalledWith({
            action: 'openTab',
            tab: {
                id: 'spritesheet:/project/assets/sprites/hero.sheet.json',
                kind: 'spritesheet',
                path: '/project/assets/sprites/hero.sheet.json',
                textContent: descriptor,
                title: 'hero.sheet.json',
            },
        });
    });

    it('opens audio entries in audiosheet editor when a companion descriptor exists', async () => {
        const descriptor = '{"source":"blip.wav","cues":{}}';
        openProjectEntryMocks.fsReadTextFile
            .mockResolvedValueOnce(descriptor)
            .mockResolvedValueOnce(descriptor);

        await openProjectEntry('/project/assets/sfx/blip.wav', 'blip.wav');

        expect(openProjectEntryMocks.applyAssetSelection).not.toHaveBeenCalled();
        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenCalledWith({
            action: 'openTab',
            tab: {
                id: 'audiosheet:/project/assets/sfx/blip.sheet.json',
                kind: 'audiosheet',
                path: '/project/assets/sfx/blip.sheet.json',
                textContent: descriptor,
                title: 'blip.sheet.json',
            },
        });
    });

    it('falls back to asset tab when no image companion descriptor exists', async () => {
        openProjectEntryMocks.fsReadTextFile.mockRejectedValueOnce(new Error('missing descriptor'));

        await openProjectEntry('/project/assets/bg/courtroom.png', 'courtroom.png');

        expect(openProjectEntryMocks.applyAssetSelection).toHaveBeenCalledWith('/assets/bg/courtroom.png');
        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenCalledWith({
            action: 'openTab',
            tab: {
                assetPath: '/assets/bg/courtroom.png',
                id: 'asset:/project/assets/bg/courtroom.png',
                kind: 'asset',
                path: '/project/assets/bg/courtroom.png',
                title: 'courtroom.png',
            },
        });
    });

    it('does not invoke the missing-spritesheet handler for default image opens', async () => {
        const onMissingDescriptor = vi.fn(() => true);
        setMissingSpritesheetDescriptorHandler(onMissingDescriptor);
        openProjectEntryMocks.fsReadTextFile.mockRejectedValueOnce(new Error('missing descriptor'));

        await openProjectEntry('/project/assets/sprites/hero.png', 'hero.png');

        expect(onMissingDescriptor).not.toHaveBeenCalled();
        expect(openProjectEntryMocks.applyAssetSelection).toHaveBeenCalledWith('/assets/sprites/hero.png');
    });

    it('invokes the missing-spritesheet handler for explicit spritesheet-open requests', async () => {
        const onMissingDescriptor = vi.fn(() => true);
        setMissingSpritesheetDescriptorHandler(onMissingDescriptor);
        openProjectEntryMocks.fsReadTextFile.mockRejectedValueOnce(new Error('missing descriptor'));

        await openProjectEntry('/project/assets/sprites/hero.png', 'hero.png', { openInSpritesheetEditor: true });

        expect(onMissingDescriptor).toHaveBeenCalledWith({
            entryName: 'hero.png',
            imagePath: '/project/assets/sprites/hero.png',
        });
        expect(openProjectEntryMocks.applyAssetSelection).not.toHaveBeenCalled();
        expect(openProjectEntryMocks.executeWorkbenchOpenAction).not.toHaveBeenCalled();
    });

    it('opens asset tabs when missing-spritesheet handler declines explicit spritesheet-open requests', async () => {
        setMissingSpritesheetDescriptorHandler(() => false);
        openProjectEntryMocks.fsReadTextFile.mockRejectedValueOnce(new Error('missing descriptor'));

        await openProjectEntry('/project/assets/bg/courtroom.png', 'courtroom.png', { openInSpritesheetEditor: true });

        expect(openProjectEntryMocks.applyAssetSelection).toHaveBeenCalledWith('/assets/bg/courtroom.png');
        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenCalledWith({
            action: 'openTab',
            tab: {
                assetPath: '/assets/bg/courtroom.png',
                id: 'asset:/project/assets/bg/courtroom.png',
                kind: 'asset',
                path: '/project/assets/bg/courtroom.png',
                title: 'courtroom.png',
            },
        });
    });

    it('opens manifest JSON using schema hints and applies forced view', async () => {
        openProjectEntryMocks.fsReadTextFile.mockResolvedValueOnce('{"$schema":"zerith/manifest"}');

        await openProjectEntry('/project/game.json', 'game.json', { forceView: 'json' });

        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenNthCalledWith(1, {
            action: 'setManifestView',
            view: 'json',
        });
        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenNthCalledWith(2, {
            action: 'openTab',
            tab: {
                id: 'manifest:/project/game.json',
                kind: 'manifest',
                path: '/project/game.json',
                preferredView: 'json',
                textContent: '{"$schema":"zerith/manifest"}',
                title: 'Project Settings',
            },
        });
    });

    it('opens blank manifest JSON as an empty manifest object', async () => {
        openProjectEntryMocks.fsReadTextFile.mockResolvedValueOnce('');

        await openProjectEntry('/project/game.json', 'game.json', { forceView: 'json' });

        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenNthCalledWith(1, {
            action: 'setManifestView',
            view: 'json',
        });
        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenNthCalledWith(2, {
            action: 'openTab',
            tab: {
                id: 'manifest:/project/game.json',
                kind: 'manifest',
                path: '/project/game.json',
                preferredView: 'json',
                textContent: '{}\n',
                title: 'Project Settings',
            },
        });
    });

    it('opens blank unhinted JSON as an empty script', async () => {
        openProjectEntryMocks.fsReadTextFile.mockResolvedValueOnce('');

        await openProjectEntry('/project/scenes/new-file.json', 'new-file.json', { forceView: 'timeline' });

        expect(openProjectEntryMocks.applyScriptFile).toHaveBeenCalledWith('/project/scenes/new-file.json', []);
        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenNthCalledWith(1, {
            action: 'setScriptView',
            view: 'timeline',
        });
        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenNthCalledWith(2, {
            action: 'openTab',
            tab: {
                id: 'script:/project/scenes/new-file.json',
                kind: 'script',
                path: '/project/scenes/new-file.json',
                preferredView: 'timeline',
                title: 'new-file.json',
            },
        });
    });

    it('opens scene JSON as a script based on manifest scene mapping', async () => {
        const sceneScript = [{ duration: 0, type: 'wait' }];
        openProjectEntryMocks.fsReadTextFile.mockResolvedValueOnce(JSON.stringify(sceneScript));

        setOpenProjectEntryState({
            manifest: {
                scenes: {
                    intro: 'scripts/intro.json',
                },
            },
            projectPath: '/project',
        });

        await openProjectEntry('/project/scripts/intro.json', 'intro.json', { forceView: 'timeline' });

        expect(openProjectEntryMocks.applyScriptFile).toHaveBeenCalledWith('/project/scripts/intro.json', sceneScript);
        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenNthCalledWith(1, {
            action: 'setScriptView',
            view: 'timeline',
        });
        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenNthCalledWith(2, {
            action: 'openTab',
            tab: {
                id: 'script:/project/scripts/intro.json',
                kind: 'script',
                path: '/project/scripts/intro.json',
                preferredView: 'timeline',
                title: 'intro.json',
            },
        });
    });

    it('prefers schema kind over manifest scene mapping when both match', async () => {
        openProjectEntryMocks.fsReadTextFile.mockResolvedValueOnce('{"$schema":"zerith/items"}');

        setOpenProjectEntryState({
            manifest: {
                scenes: {
                    intro: 'scripts/intro.json',
                },
            },
            projectPath: '/project',
        });

        await openProjectEntry('/project/scripts/intro.json', 'intro.json', { forceView: 'timeline' });

        expect(openProjectEntryMocks.applyScriptFile).not.toHaveBeenCalled();
        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenNthCalledWith(1, {
            action: 'setItemsView',
            view: 'timeline',
        });
        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenNthCalledWith(2, {
            action: 'openTab',
            tab: {
                id: 'items:/project/scripts/intro.json',
                kind: 'items',
                path: '/project/scripts/intro.json',
                preferredView: 'timeline',
                textContent: '{"$schema":"zerith/items"}',
                title: 'intro.json',
            },
        });
    });

    it('opens object JSON as macros when no manifest/schema hint is available', async () => {
        openProjectEntryMocks.fsReadTextFile.mockResolvedValueOnce('{"greet":[{"type":"wait"}]}');

        await openProjectEntry('/project/scripts/macros_local.json', 'macros_local.json');

        expect(openProjectEntryMocks.applyMacrosFile).toHaveBeenCalledWith('/project/scripts/macros_local.json', {
            greet: [{ type: 'wait' }],
        });
        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenCalledWith({
            action: 'openTab',
            tab: {
                id: 'macros:/project/scripts/macros_local.json',
                kind: 'macros',
                path: '/project/scripts/macros_local.json',
                preferredView: 'timeline',
                title: 'macros_local.json',
            },
        });
    });

    it('opens text files in a text tab', async () => {
        openProjectEntryMocks.fsReadTextFile.mockResolvedValueOnce('notes');

        await openProjectEntry('/project/notes.txt', 'notes.txt');

        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenCalledWith({
            action: 'openTab',
            tab: {
                id: 'text:/project/notes.txt',
                kind: 'text',
                path: '/project/notes.txt',
                textContent: 'notes',
                title: 'notes.txt',
            },
        });
    });

    it('opens unknown extensions in unknown tab and logs warning', async () => {
        await openProjectEntry('/project/data.bin', 'data.bin');

        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenCalledWith({
            action: 'openTab',
            tab: {
                id: 'unknown:/project/data.bin',
                kind: 'unknown',
                path: '/project/data.bin',
                title: 'data.bin',
            },
        });
        expect(openProjectEntryMocks.executeConsoleMessageAction).toHaveBeenCalledWith(
            'editor',
            'warn',
            'No handler for file type yet:',
            '/project/data.bin',
        );
    });
});

