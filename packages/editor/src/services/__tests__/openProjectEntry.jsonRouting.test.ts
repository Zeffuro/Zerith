import { describe, expect, it } from 'vitest';

import { routeJsonEntry } from '../openProjectEntry/jsonRouting';

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

