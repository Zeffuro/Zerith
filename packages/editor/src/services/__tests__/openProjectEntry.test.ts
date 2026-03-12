import type { GameManifest } from 'core';

import { beforeEach, describe, expect, it } from 'vitest';

import {
    getOpenProjectEntryMocks,
    resetOpenProjectEntryMocks,
    setOpenProjectEntryState,
} from '../../test-utils/registerOpenProjectEntryMocks';
import { openProjectEntry } from '../openProjectEntry';

const openProjectEntryMocks = getOpenProjectEntryMocks();

describe('openProjectEntry', () => {
    beforeEach(() => {
        resetOpenProjectEntryMocks();
    });

    it('opens image assets in an asset tab and updates selection', async () => {
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

    it('opens scene JSON as a script based on manifest scene mapping', async () => {
        const sceneScript = [{ duration: 0, type: 'wait' }];
        openProjectEntryMocks.fsReadTextFile.mockResolvedValueOnce(JSON.stringify(sceneScript));

        setOpenProjectEntryState({
            manifest: {
                scenes: {
                    intro: 'scripts/intro.json',
                },
            } as GameManifest,
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
            } as GameManifest,
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
