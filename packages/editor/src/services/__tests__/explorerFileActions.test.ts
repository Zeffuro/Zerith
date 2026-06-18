import { describe, expect, it } from 'vitest';

import { getDefaultContentForNewFile } from '../newFileTemplates';

describe('explorerFileActions', () => {
    it('creates valid default content for JSON files', () => {
        expect(getDefaultContentForNewFile('new-scene.json')).toBe('[]\n');
        expect(getDefaultContentForNewFile('NEW-SCENE.JSON')).toBe('[]\n');
    });

    it('keeps non-JSON files empty by default', () => {
        expect(getDefaultContentForNewFile('notes.txt')).toBe('');
        expect(getDefaultContentForNewFile('README.md')).toBe('');
    });
});
