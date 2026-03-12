import type { GameManifest } from 'core';

import { beforeEach, describe, expect, it } from 'vitest';

import {
    getOpenProjectEntryMocks,
    resetOpenProjectEntryMocks,
    setOpenProjectEntryState,
} from '../../test-utils/registerOpenProjectEntryMocks';
import { openJsonEntry } from '../openProjectEntry/index';

const openProjectEntryMocks = getOpenProjectEntryMocks();

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
            } as GameManifest,
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
            } as GameManifest,
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

