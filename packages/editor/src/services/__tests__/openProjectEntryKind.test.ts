import type { GameManifest } from 'core';

import { describe, expect, it } from 'vitest';

import {
    resolveJsonKindFromManifest,
    resolveJsonKindFromSchema,
    toProjectRelativePath,
} from '../openProjectEntryKind';

describe('openProjectEntryKind', () => {
    describe('resolveJsonKindFromSchema', () => {
        it('maps known schema ids to JSON kinds', () => {
            expect(resolveJsonKindFromSchema({ $schema: 'zerith/manifest' })).toBe('manifest');
            expect(resolveJsonKindFromSchema({ $schema: 'zerith/characters' })).toBe('characters');
            expect(resolveJsonKindFromSchema({ $schema: 'zerith/items' })).toBe('items');
            expect(resolveJsonKindFromSchema({ $schema: 'zerith/macros' })).toBe('macros');
        });

        it('returns undefined for unknown or missing schema ids', () => {
            expect(resolveJsonKindFromSchema({})).toBeUndefined();
            expect(resolveJsonKindFromSchema({ $schema: 'zerith/unknown' })).toBeUndefined();
            expect(resolveJsonKindFromSchema([])).toBeUndefined();
        });
    });

    describe('resolveJsonKindFromManifest', () => {
        it('detects manifest from game.json path without manifest state', () => {
            expect(resolveJsonKindFromManifest('/project/game.json', undefined, '/project')).toBe('manifest');
        });

        it('resolves characters and scenes using manifest-relative paths', () => {
            const manifest = {
                characters: 'data/characters.json',
                scenes: {
                    intro: 'scripts/intro.json',
                },
            } as unknown as GameManifest;

            expect(resolveJsonKindFromManifest('/project/data/characters.json', manifest, '/project')).toBe('characters');
            expect(resolveJsonKindFromManifest('/project/scripts/intro.json', manifest, '/project')).toBe('script');
        });

        it('normalizes windows separators when matching manifest paths', () => {
            const manifest = {
                macros: 'scripts/macros.json',
            } as unknown as GameManifest;

            expect(resolveJsonKindFromManifest('C:\\project\\scripts\\macros.json', manifest, 'C:\\project')).toBe('macros');
        });
    });

    describe('toProjectRelativePath', () => {
        it('returns project-relative slash path for in-project files', () => {
            expect(toProjectRelativePath('/project/assets/bg/courtroom.png', '/project')).toBe('/assets/bg/courtroom.png');
            expect(toProjectRelativePath('/project/scripts/intro.json', '/project/')).toBe('/scripts/intro.json');
        });

        it('returns the original path for files outside the project root', () => {
            expect(toProjectRelativePath('/other/scripts/intro.json', '/project')).toBe('/other/scripts/intro.json');
        });
    });
});

