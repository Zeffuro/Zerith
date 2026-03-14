import { describe, expect, it } from 'vitest';

import '../../test-utils/registerEditorServiceMocks';
import type { GlobalSearchMatch, GlobalSearchProjectData } from '../globalSearch/contracts';

import { collectMacroMatches, collectSceneMatches } from '../globalSearch/scriptSourceSearch';
import { resolveGlobalSearchTextOptions } from '../globalSearch/textSearch';

describe('globalSearch script source search helpers', () => {
    it('collects scene matches only for scenes with manifest locations and array scripts', () => {
        const matches: GlobalSearchMatch[] = [];
        const scenes = {
            intro: [{ speaker: 'Narrator', text: 'hero appears', type: 'dialogue' }],
            invalid: { text: 'hero appears' } as never,
            missing: [{ speaker: 'Narrator', text: 'hero missing', type: 'dialogue' }],
        } as unknown as GlobalSearchProjectData['scenes'];
        const manifest = {
            scenes: {
                intro: 'scripts/intro.json',
                invalid: 'scripts/invalid.json',
            },
        };

        collectSceneMatches(matches, 'hero', scenes, manifest, '/project', resolveGlobalSearchTextOptions({}));

        expect(matches.length).toBeGreaterThan(0);
        expect(matches.every((match) => match.label.includes('intro'))).toBe(true);
        expect(matches.every((match) => match.filePath.endsWith('/scripts/intro.json'))).toBe(true);
    });

    it('collects macro matches in sorted name order with indexed body root paths', () => {
        const matches: GlobalSearchMatch[] = [];
        const macros: GlobalSearchProjectData['macros'] = {
            alpha: [{ speaker: 'Guide', text: 'hero alpha', type: 'dialogue' }],
            beta: [{ speaker: 'Guide', text: 'hero beta', type: 'dialogue' }],
        };

        collectMacroMatches(
            matches,
            'hero',
            macros,
            { macrosPath: '/project/data/macros.json' },
            resolveGlobalSearchTextOptions({}),
        );

        const textMatches = matches.filter((match) => match.valuePath?.includes('text'));
        expect(textMatches.some((match) => match.label === 'Macro: alpha' && match.valuePath?.[0] === 0)).toBe(true);
        expect(textMatches.some((match) => match.label === 'Macro: beta' && match.valuePath?.[0] === 1)).toBe(true);
        expect(textMatches.every((match) => match.valuePath?.[1] === 'body')).toBe(true);
    });
});

