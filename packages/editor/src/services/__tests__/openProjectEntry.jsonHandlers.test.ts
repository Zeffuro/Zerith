import { beforeEach, describe, expect, it } from 'vitest';

import type { JsonRoute } from '../openProjectEntry/index';

import {
    getOpenProjectEntryMocks,
    resetOpenProjectEntryMocks,
} from '../../test-utils/registerOpenProjectEntryMocks';
import { handleJsonRoute } from '../openProjectEntry/index';

const openProjectEntryMocks = getOpenProjectEntryMocks();

const looksLikeMacros = (value: unknown) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

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

    it('throws for hinted script route when payload is not an array', () => {
        const route: JsonRoute = { kind: 'script', requiresArrayShape: true };

        expect(() => handleJsonRoute({
            contents: '{}',
            data: {},
            fullPath: '/project/scripts/intro.json',
            isMacrosObject: looksLikeMacros,
            route,
        })).toThrowError(new TypeError('Scene scripts must be JSON arrays.'));
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

