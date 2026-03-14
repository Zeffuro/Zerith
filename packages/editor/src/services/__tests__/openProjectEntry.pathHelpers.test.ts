import { describe, expect, it } from 'vitest';

import {
    basenameFromPath,
    isManifestFilePath,
    normalizeFilePath,
    toProjectRelativePath,
} from '../openProjectEntry/pathHelpers';

describe('openProjectEntry pathHelpers', () => {
    it('normalizes windows separators to forward slashes', () => {
        expect(normalizeFilePath(String.raw`C:\project\scripts\intro.json`)).toBe('C:/project/scripts/intro.json');
    });

    it('extracts basename for both slash styles', () => {
        expect(basenameFromPath('/project/scripts/intro.json')).toBe('intro.json');
        expect(basenameFromPath(String.raw`C:\project\scripts\intro.json`)).toBe('intro.json');
        expect(basenameFromPath('game.json')).toBe('game.json');
    });

    it('detects manifest file names case-insensitively', () => {
        expect(isManifestFilePath('/project/game.json')).toBe(true);
        expect(isManifestFilePath(String.raw`C:\project\GAME.JSON`)).toBe(true);
        expect(isManifestFilePath('/project/data/items.json')).toBe(false);
    });

    it('returns project-relative slash path for in-project files', () => {
        expect(toProjectRelativePath('/project/assets/bg/courtroom.png', '/project')).toBe('/assets/bg/courtroom.png');
        expect(toProjectRelativePath('/project/scripts/intro.json', '/project/')).toBe('/scripts/intro.json');
    });

    it('returns original path for files outside the project root', () => {
        expect(toProjectRelativePath('/other/scripts/intro.json', '/project')).toBe('/other/scripts/intro.json');
    });
});

