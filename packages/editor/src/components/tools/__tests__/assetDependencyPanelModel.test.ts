import { describe, expect, it } from 'vitest';

import {
    areAllUnusedAssetsSelected,
    classifyAssetLibraryKind,
    createAssetKindSummary,
    filterAssetDependencyGraph,
    getSelectedUnusedAssets,
    groupUnusedAssetsByFolder,
    projectRelativeAssetPathFromUrl,
    reconcileUnusedAssetSelection,
    removeUnusedAssetScope,
    selectUnusedAssetScope,
    toggleUnusedAssetSelection,
} from '../assetDependencyPanelModel';

describe('assetDependencyPanelModel', () => {
    it('defaults a new unused asset set to selected', () => {
        expect(reconcileUnusedAssetSelection([], ['/assets/a.png', '/assets/b.png'])).toEqual([
            '/assets/a.png',
            '/assets/b.png',
        ]);
    });

    it('preserves only selected assets that are still unused', () => {
        expect(reconcileUnusedAssetSelection(['/assets/b.png', '/assets/removed.png'], [
            '/assets/a.png',
            '/assets/b.png',
        ])).toEqual(['/assets/b.png']);
    });

    it('toggles selected unused assets and reports selected cleanup targets in unused order', () => {
        const selected = toggleUnusedAssetSelection(['/assets/b.png'], '/assets/a.png', true);
        expect(selected).toEqual(['/assets/a.png', '/assets/b.png']);
        expect(areAllUnusedAssetsSelected(selected, ['/assets/a.png', '/assets/b.png'])).toBe(true);

        const nextSelected = toggleUnusedAssetSelection(selected, '/assets/a.png', false);
        expect(getSelectedUnusedAssets(nextSelected, ['/assets/a.png', '/assets/b.png'])).toEqual(['/assets/b.png']);
        expect(areAllUnusedAssetsSelected(nextSelected, ['/assets/a.png', '/assets/b.png'])).toBe(false);
    });

    it('groups unused assets by containing folder for scoped cleanup', () => {
        expect(groupUnusedAssetsByFolder([
            '/assets/sprites/hero.png',
            String.raw`assets\bg\office.png`,
            '/assets/sprites/hero.sheet.json',
            '/loose.png',
        ])).toEqual([
            {
                assetUrls: ['/loose.png'],
                folder: 'assets',
            },
            {
                assetUrls: [String.raw`assets\bg\office.png`],
                folder: 'assets/bg',
            },
            {
                assetUrls: ['/assets/sprites/hero.png', '/assets/sprites/hero.sheet.json'],
                folder: 'assets/sprites',
            },
        ]);
    });

    it('normalizes project asset URLs for filesystem actions', () => {
        expect(projectRelativeAssetPathFromUrl('/assets/bg/office.png')).toBe('assets/bg/office.png');
        expect(projectRelativeAssetPathFromUrl(String.raw`assets\sprites\hero.png`)).toBe('assets/sprites/hero.png');
        expect(projectRelativeAssetPathFromUrl('https://example.test/office.png')).toBeUndefined();
        expect(projectRelativeAssetPathFromUrl('/external/office.png')).toBeUndefined();
    });

    it('filters used, unused, and missing asset rows by asset and reference text', () => {
        const graph = {
            missing: [
                {
                    assetUrl: '/assets/audio/missing.ogg',
                    references: [{ commandType: 'play_bgm', filePath: '/project/scripts/intro.json', path: [3, 'src'], sceneName: 'intro' }],
                },
            ],
            unused: ['/assets/bg/court.png', '/assets/sprites/hero.png'],
            used: [
                {
                    assetUrl: '/assets/audio/theme.ogg',
                    references: [{ commandType: 'play_bgm', filePath: '/project/scripts/intro.json', path: [1, 'src'], sceneName: 'intro' }],
                },
                {
                    assetUrl: '/assets/sprites/judge.png',
                    references: [{ commandType: 'show_sprite', filePath: '/project/scripts/trial.json', path: [2, 'sprite'], sceneName: 'trial' }],
                },
            ],
        };

        expect(filterAssetDependencyGraph(graph, 'bgm')).toEqual({
            missing: [{ assetUrl: '/assets/audio/missing.ogg', references: graph.missing[0].references }],
            unused: [],
            used: [{ assetUrl: '/assets/audio/theme.ogg', references: graph.used[0].references }],
        });

        expect(filterAssetDependencyGraph(graph, 'sprites')).toEqual({
            missing: [],
            unused: ['/assets/sprites/hero.png'],
            used: [{ assetUrl: '/assets/sprites/judge.png', references: graph.used[1].references }],
        });

        expect(filterAssetDependencyGraph(graph, '', 'audio')).toEqual({
            missing: [{ assetUrl: '/assets/audio/missing.ogg', references: graph.missing[0].references }],
            unused: [],
            used: [{ assetUrl: '/assets/audio/theme.ogg', references: graph.used[0].references }],
        });

        expect(filterAssetDependencyGraph(graph, 'intro', 'image')).toEqual({
            missing: [],
            unused: [],
            used: [],
        });
    });

    it('classifies asset library kinds and summarizes dependency graph counts', () => {
        expect(classifyAssetLibraryKind('/assets/bg/court.png')).toBe('image');
        expect(classifyAssetLibraryKind('/assets/audio/theme.ogg')).toBe('audio');
        expect(classifyAssetLibraryKind('/assets/fonts/title.woff2')).toBe('font');
        expect(classifyAssetLibraryKind('/assets/data/atlas.json')).toBe('json');
        expect(classifyAssetLibraryKind('/assets/readme.md')).toBe('text');
        expect(classifyAssetLibraryKind('/assets/archive.bin')).toBe('other');

        expect(createAssetKindSummary({
            missing: [
                {
                    assetUrl: '/assets/audio/missing.ogg',
                    references: [],
                },
            ],
            unused: [
                '/assets/bg/unused.png',
                '/assets/data/unused.sheet.json',
                '/assets/readme.md',
            ],
            used: [
                {
                    assetUrl: '/assets/bg/court.png',
                    references: [],
                },
                {
                    assetUrl: '/assets/audio/theme.ogg',
                    references: [],
                },
            ],
        })).toEqual([
            {
                kind: 'image',
                missing: 0,
                total: 2,
                unused: 1,
                used: 1,
            },
            {
                kind: 'audio',
                missing: 1,
                total: 2,
                unused: 0,
                used: 1,
            },
            {
                kind: 'json',
                missing: 0,
                total: 1,
                unused: 1,
                used: 0,
            },
            {
                kind: 'text',
                missing: 0,
                total: 1,
                unused: 1,
                used: 0,
            },
        ]);
    });

    it('adds and removes scoped unused asset selections', () => {
        expect(selectUnusedAssetScope(['/assets/b.png'], ['/assets/a.png', '/assets/b.png'])).toEqual([
            '/assets/a.png',
            '/assets/b.png',
        ]);

        expect(removeUnusedAssetScope(['/assets/a.png', '/assets/b.png', '/assets/c.png'], ['/assets/b.png'])).toEqual([
            '/assets/a.png',
            '/assets/c.png',
        ]);
    });
});
