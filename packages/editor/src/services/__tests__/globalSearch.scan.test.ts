import { describe, expect, it } from 'vitest';

import '../../test-utils/registerEditorServiceMocks';
import { scanRecordStringLeaves, scanScriptNodes, resolveGlobalSearchTextOptions } from '../globalSearch/index';
import type { GlobalSearchMatch } from '../globalSearch/contracts';

describe('globalSearch scan helpers', () => {
    it('scans script node string leaves with value paths', () => {
        const matches: GlobalSearchMatch[] = [];
        scanScriptNodes(matches, {
            filePath: '/project/scripts/intro.json',
            kind: 'scene',
            label: 'Scene: intro',
            query: 'hero',
            rootPath: [],
            script: [{ speaker: 'Narrator', text: 'hero appears', type: 'dialogue' }],
            textOptions: resolveGlobalSearchTextOptions({}),
        });

        const textMatch = matches.find((match) => match.valuePath?.join('.') === '0.text');
        expect(textMatch).toBeDefined();
        expect(textMatch?.kind).toBe('scene');
        expect(textMatch?.replaceable).toBe(true);
    });

    it('scans character/item records recursively and keeps entry navigation path', () => {
        const matches: GlobalSearchMatch[] = [];
        scanRecordStringLeaves(matches, {
            filePath: '/project/data/characters.json',
            kind: 'character',
            query: 'hero',
            textOptions: resolveGlobalSearchTextOptions({}),
            values: {
                hero: {
                    displayName: 'Hero',
                    meta: {
                        title: 'hero of justice',
                    },
                    name: 'hero',
                },
            },
        });

        expect(matches.length).toBeGreaterThan(0);
        expect(matches.every((match) => match.path?.[0] === 'hero')).toBe(true);
        expect(matches.some((match) => match.valuePath?.join('.') === 'hero.meta.title')).toBe(true);
    });
});

