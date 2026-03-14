import { describe, expect, it } from 'vitest';

import '../../test-utils/registerEditorServiceMocks';
import type { GlobalSearchMatch } from '../globalSearch/contracts';

import { scanLeafStrings } from '../globalSearch/scan';
import { resolveGlobalSearchTextOptions } from '../globalSearch/textSearch';

describe('globalSearch scanLeafStrings helper', () => {
    it('recursively scans nested object/array leaves and records deep value paths', () => {
        const matches: GlobalSearchMatch[] = [];

        scanLeafStrings(matches, {
            basePath: ['root'],
            filePath: '/project/scripts/intro.json',
            kind: 'scene',
            label: 'Scene: intro',
            navigationPath: ['root'],
            query: 'hero',
            textOptions: resolveGlobalSearchTextOptions({}),
            value: {
                lines: [
                    { text: 'hero first line' },
                    { text: 'second line' },
                    { text: 'third hero line' },
                ],
                meta: {
                    note: 'hero note',
                },
            },
        });

        expect(matches.length).toBe(3);
        expect(matches.every((match) => match.path?.join('.') === 'root')).toBe(true);
        expect(matches.some((match) => match.valuePath?.join('.') === 'root.lines.0.text')).toBe(true);
        expect(matches.some((match) => match.valuePath?.join('.') === 'root.lines.2.text')).toBe(true);
        expect(matches.some((match) => match.valuePath?.join('.') === 'root.meta.note')).toBe(true);
    });

    it('keeps navigation path undefined when scanning non-navigable leaves', () => {
        const matches: GlobalSearchMatch[] = [];

        scanLeafStrings(matches, {
            basePath: ['payload'],
            filePath: '/project/data/items.json',
            kind: 'item',
            label: 'Item: badge',
            navigationPath: undefined,
            query: 'badge',
            textOptions: resolveGlobalSearchTextOptions({}),
            value: {
                tags: ['starter', 'badge token'],
            },
        });

        expect(matches).toHaveLength(1);
        expect(matches[0]?.path).toBeUndefined();
        expect(matches[0]?.valuePath?.join('.')).toBe('payload.tags.1');
    });
});

