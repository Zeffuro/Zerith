import { describe, expect, it } from 'vitest';

import '../../test-utils/registerEditorServiceMocks';
import { createGlobalSearchProjectData } from '../../test-utils/projectDataBuilder';
import { collectSearchMatches } from '../globalSearch/orchestration';
import { resolveGlobalSearchTextOptions } from '../globalSearch/textSearch';

describe('globalSearch orchestration helpers', () => {
    it('collects matches across scene/macro/character/item sources', () => {
        const projectData = createGlobalSearchProjectData();
        const matches = collectSearchMatches('hero', projectData, resolveGlobalSearchTextOptions({}));
        const kinds = new Set(matches.map((match) => match.kind));

        expect(matches.length).toBeGreaterThan(0);
        expect(kinds.has('scene')).toBe(true);
        expect(kinds.has('macro')).toBe(true);
        expect(kinds.has('character')).toBe(true);
        expect(kinds.has('item')).toBe(true);
    });


    it('prefixes macro value paths with macro index/body root path', () => {
        const projectData = createGlobalSearchProjectData({
            macros: {
                alpha: [{ speaker: 'Guide', text: 'hero alpha', type: 'dialogue' }],
                beta: [{ speaker: 'Guide', text: 'hero beta', type: 'dialogue' }],
            },
        });

        const matches = collectSearchMatches('hero', projectData, resolveGlobalSearchTextOptions({}));
        const macroMatches = matches.filter((match) => match.kind === 'macro');

        expect(macroMatches.length).toBeGreaterThan(0);
        expect(macroMatches.every((match) => match.valuePath?.[1] === 'body')).toBe(true);
        expect(macroMatches.some((match) => match.valuePath?.[0] === 0)).toBe(true);
        expect(macroMatches.some((match) => match.valuePath?.[0] === 1)).toBe(true);
    });

    it('returns an empty result when orchestration request is invalid', () => {
        const projectData = createGlobalSearchProjectData({ projectPath: undefined });

        const matches = collectSearchMatches('hero', projectData, resolveGlobalSearchTextOptions({}));

        expect(matches).toEqual([]);
    });
});

