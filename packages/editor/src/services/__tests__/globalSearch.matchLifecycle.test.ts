import { describe, expect, it } from 'vitest';

import '../../test-utils/registerEditorServiceMocks';
import { createGlobalSearchProjectData } from '../../test-utils/projectDataBuilder';
import { collectOrchestratedMatches } from '../globalSearch/matchLifecycle';
import { resolveGlobalSearchTextOptions } from '../globalSearch/textSearch';

describe('globalSearch match lifecycle helpers', () => {
    it('collects matches across all orchestrated sources', () => {
        const projectData = createGlobalSearchProjectData();
        const matches = collectOrchestratedMatches('hero', projectData, resolveGlobalSearchTextOptions({}));
        const kinds = new Set(matches.map((match) => match.kind));

        expect(matches.length).toBeGreaterThan(0);
        expect(kinds.has('scene')).toBe(true);
        expect(kinds.has('macro')).toBe(true);
        expect(kinds.has('character')).toBe(true);
        expect(kinds.has('item')).toBe(true);
    });

    it('returns an empty array when all sources are empty', () => {
        const projectData = createGlobalSearchProjectData({
            characters: {},
            items: {},
            macros: {},
            scenes: {},
        });

        expect(collectOrchestratedMatches('hero', projectData, resolveGlobalSearchTextOptions({}))).toEqual([]);
    });

    it('preserves macro root path indexing from sorted macro names', () => {
        const projectData = createGlobalSearchProjectData({
            macros: {
                beta: [{ speaker: 'Guide', text: 'hero beta', type: 'dialogue' }],
                alpha: [{ speaker: 'Guide', text: 'hero alpha', type: 'dialogue' }],
            },
        });

        const matches = collectOrchestratedMatches('hero', projectData, resolveGlobalSearchTextOptions({}));
        const macroMatches = matches.filter((match) => match.kind === 'macro' && match.valuePath?.includes('text'));

        expect(macroMatches.some((match) => match.label === 'Macro: alpha' && match.valuePath?.[0] === 0)).toBe(true);
        expect(macroMatches.some((match) => match.label === 'Macro: beta' && match.valuePath?.[0] === 1)).toBe(true);
        expect(macroMatches.every((match) => match.valuePath?.[1] === 'body')).toBe(true);
    });
});

