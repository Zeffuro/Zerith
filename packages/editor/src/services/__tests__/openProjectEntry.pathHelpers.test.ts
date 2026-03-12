import { describe, expect, it } from 'vitest';

import {
    basenameFromPath,
    isManifestFilePath,
    normalizeFilePath,
} from '../openProjectEntry/pathHelpers';

describe('openProjectEntry pathHelpers', () => {
    it('normalizes windows separators to forward slashes', () => {
        expect(normalizeFilePath('C:\\project\\scripts\\intro.json')).toBe('C:/project/scripts/intro.json');
    });

    it('extracts basename for both slash styles', () => {
        expect(basenameFromPath('/project/scripts/intro.json')).toBe('intro.json');
        expect(basenameFromPath('C:\\project\\scripts\\intro.json')).toBe('intro.json');
        expect(basenameFromPath('game.json')).toBe('game.json');
    });

    it('detects manifest file names case-insensitively', () => {
        expect(isManifestFilePath('/project/game.json')).toBe(true);
        expect(isManifestFilePath('C:\\project\\GAME.JSON')).toBe(true);
        expect(isManifestFilePath('/project/data/items.json')).toBe(false);
    });
});

