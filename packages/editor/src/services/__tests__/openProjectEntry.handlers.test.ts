import { beforeEach, describe, expect, it } from 'vitest';

import type { JsonRoute } from '../openProjectEntry';

import {
    getOpenProjectEntryMocks,
    resetOpenProjectEntryMocks,
    setOpenProjectEntryState,
} from '../../test-utils/registerOpenProjectEntryMocks';
import {
    handleJsonRoute,
    openAssetEntry,
    openAudiosheetEntry,
    openJsonEntry,
    openMacrosTab,
    openScriptTab,
    openSpritesheetEntry,
    openTextEntry,
    openUnknownEntry,
} from '../openProjectEntry';

const openProjectEntryMocks = getOpenProjectEntryMocks();
const looksLikeMacros = (value: unknown) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

describe('openProjectEntry jsonCoordinator', () => {
    beforeEach(() => {
        resetOpenProjectEntryMocks();
    });

    it('prefers schema kind over manifest-derived kind when both are present', async () => {
        openProjectEntryMocks.fsReadTextFile.mockResolvedValueOnce('{"$schema":"zerith/items"}');

        setOpenProjectEntryState({
            manifest: {
                scenes: {
                    intro: 'scripts/intro.json',
                },
            },
            projectPath: '/project',
        });

        await openJsonEntry('/project/scripts/intro.json', { forceView: 'timeline' });

        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenNthCalledWith(1, {
            action: 'setItemsView',
            view: 'timeline',
        });
        expect(openProjectEntryMocks.applyScriptFile).not.toHaveBeenCalled();
    });

    it('uses manifest scene mapping when schema hint is absent', async () => {
        const script = [{ type: 'wait' }];
        openProjectEntryMocks.fsReadTextFile.mockResolvedValueOnce(JSON.stringify(script));

        setOpenProjectEntryState({
            manifest: {
                scenes: {
                    intro: 'scripts/intro.json',
                },
            },
            projectPath: '/project',
        });

        await openJsonEntry('/project/scripts/intro.json', { forceView: 'timeline' });

        expect(openProjectEntryMocks.applyScriptFile).toHaveBeenCalledWith('/project/scripts/intro.json', script);
        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenNthCalledWith(1, {
            action: 'setScriptView',
            view: 'timeline',
        });
    });

    it('routes game.json fallback through manifest tab handling', async () => {
        openProjectEntryMocks.fsReadTextFile.mockResolvedValueOnce('{"name":"project"}');

        await openJsonEntry('/project/game.json', { forceView: 'json' });

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
                textContent: '{"name":"project"}',
                title: 'Project Settings',
            },
        });
    });
});

describe('openProjectEntry jsonHandlers', () => {
    beforeEach(() => {
        resetOpenProjectEntryMocks();
    });

    it('handles resource route with forced view and tab open payload', () => {
        const route: JsonRoute = { kind: 'resource', resourceKind: 'items' };

        handleJsonRoute({
            contents: '{"$schema":"zerith/items"}',
            data: { $schema: 'zerith/items' },
            forceView: 'timeline',
            fullPath: '/project/data/items.json',
            isMacrosObject: looksLikeMacros,
            route,
        });

        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenNthCalledWith(1, {
            action: 'setItemsView',
            view: 'timeline',
        });
        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenNthCalledWith(2, {
            action: 'openTab',
            tab: {
                id: 'items:/project/data/items.json',
                kind: 'items',
                path: '/project/data/items.json',
                preferredView: 'timeline',
                textContent: '{"$schema":"zerith/items"}',
                title: 'items.json',
            },
        });
    });

    it('handles engineConfig resource route with engine config title', () => {
        const route: JsonRoute = { kind: 'resource', resourceKind: 'engineConfig' };

        handleJsonRoute({
            contents: '{"display":{"width":1024}}',
            data: { display: { width: 1024 } },
            forceView: 'json',
            fullPath: '/project/engine.config.json',
            isMacrosObject: looksLikeMacros,
            route,
        });

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
                textContent: '{"display":{"width":1024}}',
                title: 'Engine Config',
            },
        });
    });

    it('throws for hinted script route when payload is not a scene file', () => {
        const route: JsonRoute = { kind: 'script', requiresArrayShape: true };

        expect(() => handleJsonRoute({
            contents: '{}',
            data: {},
            fullPath: '/project/scripts/intro.json',
            isMacrosObject: looksLikeMacros,
            route,
        })).toThrowError(new TypeError('Scene scripts must be JSON arrays or scene objects with a commands array.'));
    });

    it('handles macros route and applies macros opener path', () => {
        const route: JsonRoute = { kind: 'macros', requiresObjectShape: false };

        handleJsonRoute({
            contents: '{"greet":[]}',
            data: { greet: [] },
            fullPath: '/project/data/macros.json',
            isMacrosObject: looksLikeMacros,
            route,
        });

        expect(openProjectEntryMocks.applyMacrosFile).toHaveBeenCalledWith('/project/data/macros.json', { greet: [] });
        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenCalledWith({
            action: 'openTab',
            tab: {
                id: 'macros:/project/data/macros.json',
                kind: 'macros',
                path: '/project/data/macros.json',
                preferredView: 'timeline',
                title: 'macros.json',
            },
        });
    });

    it('handles unknown manifest route with forced manifest view', () => {
        const route: JsonRoute = { kind: 'unknownJson', tabKind: 'manifest' };

        handleJsonRoute({
            contents: '{}',
            data: {},
            forceView: 'json',
            fullPath: '/project/game.json',
            isMacrosObject: looksLikeMacros,
            route,
        });

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
                textContent: '{}',
                title: 'Project Settings',
            },
        });
    });
});

describe('openProjectEntry nonJsonHandlers', () => {
    beforeEach(() => {
        resetOpenProjectEntryMocks();
    });

    it('opens an asset tab using project-relative asset selection', () => {
        setOpenProjectEntryState({ projectPath: '/project' });

        openAssetEntry('/project/assets/bg/courtroom.png');

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

    it('opens a text tab with file content', async () => {
        openProjectEntryMocks.fsReadTextFile.mockResolvedValueOnce('notes');

        await openTextEntry('/project/notes.txt');

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

    it('opens a spritesheet tab with descriptor content', async () => {
        openProjectEntryMocks.fsReadTextFile.mockResolvedValueOnce('{"format":"atlas","source":"hero.png","frames":{}}');

        await openSpritesheetEntry('/project/assets/sprites/hero.sheet.json');

        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenCalledWith({
            action: 'openTab',
            tab: {
                id: 'spritesheet:/project/assets/sprites/hero.sheet.json',
                kind: 'spritesheet',
                path: '/project/assets/sprites/hero.sheet.json',
                textContent: '{"format":"atlas","source":"hero.png","frames":{}}',
                title: 'hero.sheet.json',
            },
        });
    });

    it('opens an audiosheet tab with descriptor content', async () => {
        openProjectEntryMocks.fsReadTextFile.mockResolvedValueOnce('{"source":"blip.wav","cues":{}}');

        await openAudiosheetEntry('/project/assets/sfx/blip.sheet.json');

        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenCalledWith({
            action: 'openTab',
            tab: {
                id: 'audiosheet:/project/assets/sfx/blip.sheet.json',
                kind: 'audiosheet',
                path: '/project/assets/sfx/blip.sheet.json',
                textContent: '{"source":"blip.wav","cues":{}}',
                title: 'blip.sheet.json',
            },
        });
    });

    it('opens unknown tabs and logs a warning', () => {
        openUnknownEntry('/project/data.bin');

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

describe('openProjectEntry tabOpeners', () => {
    beforeEach(() => {
        resetOpenProjectEntryMocks();
    });

    it('opens script tab and applies forced script view', () => {
        openScriptTab('/project/scripts/intro.json', 'timeline');

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

    it('opens macros tab without forcing view when not provided', () => {
        openMacrosTab('/project/scripts/macros.json');

        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenCalledTimes(1);
        expect(openProjectEntryMocks.executeWorkbenchOpenAction).toHaveBeenCalledWith({
            action: 'openTab',
            tab: {
                id: 'macros:/project/scripts/macros.json',
                kind: 'macros',
                path: '/project/scripts/macros.json',
                preferredView: 'timeline',
                title: 'macros.json',
            },
        });
    });
});

