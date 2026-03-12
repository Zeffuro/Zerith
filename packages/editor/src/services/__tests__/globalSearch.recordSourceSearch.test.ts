import { describe, expect, it } from 'vitest';

import '../../test-utils/registerEditorServiceMocks';
import { collectCharacterMatches, collectItemMatches } from '../globalSearch/recordSourceSearch';
import { resolveGlobalSearchTextOptions } from '../globalSearch/textSearch';
import type { GlobalSearchMatch, GlobalSearchProjectData } from '../globalSearch/contracts';

describe('globalSearch record source search helpers', () => {
    it('collects character matches with expected kind, label, and file path', () => {
        const matches: GlobalSearchMatch[] = [];
        const characters: GlobalSearchProjectData['characters'] = {
            hero: { displayName: 'Hero', name: 'hero' },
        };

        collectCharacterMatches(
            matches,
            'hero',
            characters,
            { charactersPath: '/project/data/characters.json' },
            resolveGlobalSearchTextOptions({}),
        );

        expect(matches.length).toBeGreaterThan(0);
        expect(matches.every((match) => match.kind === 'character')).toBe(true);
        expect(matches.some((match) => match.label === 'Character: hero')).toBe(true);
        expect(matches.every((match) => match.filePath === '/project/data/characters.json')).toBe(true);
    });

    it('collects item matches and no-ops for empty records', () => {
        const populatedMatches: GlobalSearchMatch[] = [];
        const items: GlobalSearchProjectData['items'] = {
            badge: { description: 'hero item', name: 'Hero Badge' },
        };

        collectItemMatches(
            populatedMatches,
            'hero',
            items,
            { itemsPath: '/project/data/items.json' },
            resolveGlobalSearchTextOptions({}),
        );

        expect(populatedMatches.length).toBeGreaterThan(0);
        expect(populatedMatches.every((match) => match.kind === 'item')).toBe(true);
        expect(populatedMatches.some((match) => match.label === 'Item: badge')).toBe(true);

        const emptyMatches: GlobalSearchMatch[] = [];
        collectItemMatches(
            emptyMatches,
            'hero',
            {},
            { itemsPath: '/project/data/items.json' },
            resolveGlobalSearchTextOptions({}),
        );

        expect(emptyMatches).toEqual([]);
    });
});

