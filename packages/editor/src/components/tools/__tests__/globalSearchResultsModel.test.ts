import { describe, expect, it } from 'vitest';

import type { GlobalSearchMatch } from '../../../services/globalSearch';

import { buildReplacePreviewMap, groupMatchesByFile, indexMatches } from '../globalSearchResultsModel';

function makeMatch(overrides?: Partial<GlobalSearchMatch>): GlobalSearchMatch {
    return {
        filePath: '/project/scripts/intro.json',
        kind: 'scene',
        label: 'Intro',
        matchedValue: 'hero enters',
        path: [0],
        preview: 'hero enters the room',
        replaceable: true,
        valuePath: [0, 'text'],
        ...overrides,
    };
}

describe('globalSearchResultsModel', () => {
    it('groups matches by file path while preserving first-seen order', () => {
        const first = makeMatch({ filePath: '/project/scripts/intro.json', path: [0] });
        const second = makeMatch({ filePath: '/project/data/characters.json', kind: 'character', path: ['hero'] });
        const third = makeMatch({ filePath: '/project/scripts/intro.json', path: [1] });

        const grouped = groupMatchesByFile([first, second, third]);

        expect(grouped).toHaveLength(2);
        expect(grouped[0][0]).toBe('/project/scripts/intro.json');
        expect(grouped[0][1]).toEqual([first, third]);
        expect(grouped[1][0]).toBe('/project/data/characters.json');
        expect(grouped[1][1]).toEqual([second]);
    });

    it('indexes match objects by their global result position', () => {
        const first = makeMatch({ path: [0] });
        const second = makeMatch({ path: [1] });

        const indexMap = indexMatches([first, second]);

        expect(indexMap.get(first)).toBe(0);
        expect(indexMap.get(second)).toBe(1);
    });

    it('builds replacement previews only for changed replaceable matches', () => {
        const changed = makeMatch({ matchedValue: 'hero and hero', valuePath: [0, 'text'] });
        const unchanged = makeMatch({ matchedValue: 'villain', valuePath: [1, 'text'] });
        const notReplaceable = makeMatch({ matchedValue: 'hero', replaceable: false, valuePath: [2, 'text'] });

        const previews = buildReplacePreviewMap(
            [changed, unchanged, notReplaceable],
            'hero',
            'champion',
            { caseSensitive: true, regex: false },
        );

        expect(previews.size).toBe(1);
        expect(previews.get('/project/scripts/intro.json-0.text-0')).toBe('champion and champion');
    });

    it('returns an empty preview map when query or replacement is blank', () => {
        const match = makeMatch();

        expect(buildReplacePreviewMap([match], '   ', 'champion', { caseSensitive: false, regex: false }).size).toBe(0);
        expect(buildReplacePreviewMap([match], 'hero', '', { caseSensitive: false, regex: false }).size).toBe(0);
    });
});

