import { describe, expect, it } from 'vitest';

import {
    getExportProfileCatalog,
    getExportProfileMetadata,
    resolveDesktopExportOutputPath,
    resolveExportGameOptions,
} from '../exportGame';

describe('exportGame profiles', () => {
    it('resolves profile defaults and preserves explicit overrides', () => {
        expect(resolveExportGameOptions({ profile: 'itch-html5' })).toMatchObject({
            base: './',
            cachePolicy: 'hashed',
            profile: 'itch-html5',
            zip: true,
        });

        expect(resolveExportGameOptions({
            cachePolicy: 'none',
            profile: 'generic-web',
            zip: true,
        })).toMatchObject({
            base: './',
            cachePolicy: 'none',
            profile: 'generic-web',
            zip: true,
        });
    });

    it('uses the local preview profile for uncached loose exports', () => {
        expect(resolveExportGameOptions({ profile: 'local-preview' })).toMatchObject({
            base: './',
            cachePolicy: 'none',
            profile: 'local-preview',
            zip: false,
        });
    });

    it('parses desktop export output paths from build stdout', () => {
        expect(resolveDesktopExportOutputPath(
            String.raw`Built game from F:\Coding\Zerith\games\classic-vn-starter to F:\Coding\Zerith\dist\classic-vn-starter (base: ./)` + '\n',
        )).toBe(String.raw`F:\Coding\Zerith\dist\classic-vn-starter`);
        expect(resolveDesktopExportOutputPath('', 'dist/fallback')).toBe('dist/fallback');
    });

    it('describes supported web export profiles and planned desktop packaging separately', () => {
        const catalog = getExportProfileCatalog();

        expect(catalog.filter((entry) => entry.selectable).map((entry) => entry.id)).toEqual([
            'itch-html5',
            'generic-web',
            'local-preview',
        ]);
        expect(catalog.find((entry) => entry.id === 'desktop-tauri')).toMatchObject({
            selectable: false,
            status: 'planned',
            target: 'desktop',
        });
        expect(catalog.find((entry) => entry.id === 'github-pages-dual')).toMatchObject({
            selectable: false,
            status: 'planned',
            target: 'web',
        });
        expect(getExportProfileMetadata('itch-html5')).toMatchObject({
            id: 'itch-html5',
            status: 'supported',
            target: 'web',
        });
    });
});
