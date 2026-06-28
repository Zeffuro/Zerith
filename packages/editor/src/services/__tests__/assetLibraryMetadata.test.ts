import { describe, expect, it, vi } from 'vitest';

import {
    ASSET_LIBRARY_METADATA_FILE_NAME,
    addAssetLibraryCollectionToAssets,
    addAssetLibraryMetadataToAssets,
    createEmptyAssetLibraryMetadata,
    loadAssetLibraryMetadata,
    moveAssetLibraryMetadataScope,
    normalizeAssetLibraryLabels,
    normalizeAssetLibraryMetadata,
    parseAssetLibraryLabelInput,
    removeAssetLibraryCollection,
    renameAssetLibraryCollection,
    saveAssetLibraryMetadata,
    setAssetLibraryAssetMetadata,
    type AssetLibraryMetadataDependencies,
} from '../assetLibraryMetadata';

function createDependencies(
    readTextFile = vi.fn<(_path: string) => Promise<string>>(),
): AssetLibraryMetadataDependencies {
    return {
        join: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/').replaceAll(/\/+/gu, '/'))),
        mkdir: vi.fn(() => Promise.resolve()),
        readTextFile,
        writeTextFile: vi.fn(() => Promise.resolve()),
    };
}

describe('assetLibraryMetadata', () => {
    it('normalizes labels and metadata entries deterministically', () => {
        expect(normalizeAssetLibraryLabels([' hero ', 'Hero', '', 'production  ready', 3])).toEqual([
            'hero',
            'production ready',
        ]);

        expect(parseAssetLibraryLabelInput('hero, backgrounds\nUI,hero')).toEqual([
            'backgrounds',
            'hero',
            'UI',
        ]);

        expect(normalizeAssetLibraryMetadata({
            assets: {
                '/assets/bg/office.png': {
                    collections: ['Backgrounds'],
                    tags: [' indoor ', 'Indoor'],
                },
                'assets/sfx/click.wav': {
                    tags: ['ui'],
                },
                'external/file.png': {
                    tags: ['ignored'],
                },
            },
        })).toEqual({
            assets: {
                '/assets/bg/office.png': {
                    collections: ['Backgrounds'],
                    tags: ['indoor'],
                },
                '/assets/sfx/click.wav': {
                    collections: [],
                    tags: ['ui'],
                },
            },
            schemaVersion: 1,
            type: 'zerith.assetLibrary',
        });
    });

    it('sets, clears, and moves asset metadata scopes', () => {
        const metadata = setAssetLibraryAssetMetadata(
            createEmptyAssetLibraryMetadata(),
            '/assets/bg/office.png',
            { collections: ['Backgrounds'], tags: ['indoor'] },
        );
        const withSprite = setAssetLibraryAssetMetadata(
            metadata,
            '/assets/sprites/hero.png',
            { collections: ['Characters'], tags: ['hero'] },
        );
        const moved = moveAssetLibraryMetadataScope(withSprite, '/assets/sprites', '/assets/characters');

        expect(moved.assets['/assets/characters/hero.png']).toEqual({
            collections: ['Characters'],
            tags: ['hero'],
        });
        expect(moved.assets['/assets/sprites/hero.png']).toBeUndefined();

        expect(setAssetLibraryAssetMetadata(moved, '/assets/bg/office.png', {
            collections: [],
            tags: [],
        }).assets['/assets/bg/office.png']).toBeUndefined();
    });

    it('adds, renames, and removes collections across asset metadata', () => {
        const metadata = addAssetLibraryCollectionToAssets(
            setAssetLibraryAssetMetadata(
                createEmptyAssetLibraryMetadata(),
                '/assets/bg/office.png',
                { collections: ['Backgrounds'], tags: ['indoor'] },
            ),
            [
                '/assets/bg/office.png',
                '/assets/sprites/hero.png',
                'assets/sprites/rival.png',
                'external/file.png',
            ],
            ' Characters ',
        );

        expect(metadata.assets).toMatchObject({
            '/assets/bg/office.png': {
                collections: ['Backgrounds', 'Characters'],
                tags: ['indoor'],
            },
            '/assets/sprites/hero.png': {
                collections: ['Characters'],
                tags: [],
            },
            '/assets/sprites/rival.png': {
                collections: ['Characters'],
                tags: [],
            },
        });

        const renamed = renameAssetLibraryCollection(metadata, 'characters', 'Cast');
        expect(renamed.assets['/assets/bg/office.png']?.collections).toEqual(['Backgrounds', 'Cast']);
        expect(renamed.assets['/assets/sprites/hero.png']?.collections).toEqual(['Cast']);

        const caseRenamed = renameAssetLibraryCollection(renamed, 'cast', 'CAST');
        expect(caseRenamed.assets['/assets/sprites/hero.png']?.collections).toEqual(['CAST']);

        const removed = removeAssetLibraryCollection(caseRenamed, 'cast');
        expect(removed.assets['/assets/bg/office.png']).toEqual({
            collections: ['Backgrounds'],
            tags: ['indoor'],
        });
        expect(removed.assets['/assets/sprites/hero.png']).toBeUndefined();
        expect(removed.assets['/assets/sprites/rival.png']).toBeUndefined();
    });

    it('appends bulk asset metadata labels without duplicating existing labels', () => {
        const metadata = addAssetLibraryMetadataToAssets(
            setAssetLibraryAssetMetadata(
                createEmptyAssetLibraryMetadata(),
                '/assets/bg/office.png',
                { collections: ['Backgrounds'], tags: ['indoor'] },
            ),
            [
                '/assets/bg/office.png',
                '/assets/audio/theme.ogg',
                'external/file.png',
            ],
            {
                collections: ['Backgrounds', 'Review'],
                tags: [' indoor ', 'Needs Review'],
            },
        );

        expect(metadata.assets['/assets/bg/office.png']).toEqual({
            collections: ['Backgrounds', 'Review'],
            tags: ['indoor', 'Needs Review'],
        });
        expect(metadata.assets['/assets/audio/theme.ogg']).toEqual({
            collections: ['Backgrounds', 'Review'],
            tags: ['indoor', 'Needs Review'],
        });
        expect(metadata.assets['external/file.png']).toBeUndefined();
    });

    it('loads missing metadata as empty and writes normalized metadata', async () => {
        const readTextFile = vi.fn<(_path: string) => Promise<string>>()
            .mockRejectedValueOnce(new Error('missing'))
            .mockResolvedValueOnce(JSON.stringify({
                assets: {
                    '/assets/bg/office.png': { tags: ['indoor'] },
                },
            }));
        const dependencies = createDependencies(readTextFile);

        await expect(loadAssetLibraryMetadata('/project', dependencies)).resolves.toEqual(createEmptyAssetLibraryMetadata());
        await expect(loadAssetLibraryMetadata('/project', dependencies)).resolves.toMatchObject({
            assets: {
                '/assets/bg/office.png': {
                    tags: ['indoor'],
                },
            },
        });

        await saveAssetLibraryMetadata('/project', {
            ...createEmptyAssetLibraryMetadata(),
            assets: {
                '/assets/bg/office.png': {
                    collections: ['Backgrounds'],
                    tags: ['indoor'],
                },
            },
        }, dependencies);

        expect(dependencies.mkdir).toHaveBeenCalledWith('/project/assets', true);
        expect(dependencies.writeTextFile).toHaveBeenCalledWith(
            `/project/assets/${ASSET_LIBRARY_METADATA_FILE_NAME}`,
            expect.stringContaining('"type": "zerith.assetLibrary"'),
        );
    });
});
