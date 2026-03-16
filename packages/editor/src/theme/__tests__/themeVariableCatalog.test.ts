import { describe, expect, it } from 'vitest';

import { createSliceHarness } from '../../test-utils/createSliceHarness';
import { getVariableCategories, getVariablesByCategory } from '../themeVariableCatalog';

describe('themeVariableCatalog grouping', () => {
    it('returns ordered categories based on supported css prefixes', () => {
        const harness = createSliceHarness({ categories: [] as string[] });
        harness.setState({ categories: getVariableCategories() });

        expect(harness.get().categories).toEqual([
            'Background',
            'Text',
            'Border',
            'Accent',
            'Radius',
            'Shadow',
            'Syntax',
        ]);
    });

    it('groups background variables from css var prefixes', () => {
        const variables = getVariablesByCategory('Background');

        expect(variables.length).toBeGreaterThan(0);
        expect(variables.every((entry) => entry.cssVar.startsWith('--editor-bg-'))).toBe(true);
    });

    it('returns empty results for unsupported categories', () => {
        const variables = getVariablesByCategory('Icon');

        expect(variables).toEqual([]);
    });
});

