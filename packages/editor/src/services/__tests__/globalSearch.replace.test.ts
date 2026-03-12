import { describe, expect, it } from 'vitest';

import { createGlobalSearchProjectData } from '../../test-utils/projectDataBuilder';
import { applyMatchReplacement } from '../globalSearch/replace';
import { resolveGlobalSearchTextOptions } from '../globalSearch/textSearch';
import type { GlobalSearchMatch } from '../globalSearch/contracts';

describe('globalSearch replace helpers', () => {

    it('applies replacements for macro and scene matches', () => {
        const data = createGlobalSearchProjectData();
        const textOptions = resolveGlobalSearchTextOptions({});

        const macroMatch: GlobalSearchMatch = {
            filePath: '/project/data/macros.json',
            kind: 'macro',
            label: 'Macro: greet',
            matchedValue: 'hello hero',
            path: [0, 'text'],
            preview: 'hello hero',
            replaceable: true,
            valuePath: [0, 'body', 0, 'text'],
        };
        const sceneMatch: GlobalSearchMatch = {
            filePath: '/project/scripts/intro.json',
            kind: 'scene',
            label: 'Scene: intro',
            matchedValue: 'hero appears',
            path: [0, 'text'],
            preview: 'hero appears',
            replaceable: true,
            valuePath: [0, 'text'],
        };

        const macroChanged = applyMatchReplacement({
            match: macroMatch,
            nextCharacters: structuredClone(data.characters),
            nextItems: structuredClone(data.items),
            nextMacros: data.macros,
            nextScenes: data.scenes,
            query: 'hero',
            replacement: 'champion',
            textOptions,
        });
        const sceneChanged = applyMatchReplacement({
            match: sceneMatch,
            nextCharacters: structuredClone(data.characters),
            nextItems: structuredClone(data.items),
            nextMacros: data.macros,
            nextScenes: data.scenes,
            query: 'hero',
            replacement: 'champion',
            textOptions,
        });

        expect(macroChanged).toBe(true);
        expect(sceneChanged).toBe(true);
        expect(data.macros.greet[0]?.text).toBe('hello champion');
        expect(data.scenes.intro[0]?.text).toBe('champion appears');
    });
});

