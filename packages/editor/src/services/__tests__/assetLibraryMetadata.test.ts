import { describe, expect, it, vi } from 'vitest';

import {
    addAssetLibraryCollectionToAssets,
    addAssetLibraryMetadataToAssets,
    ASSET_LIBRARY_METADATA_FILE_NAME,
    type AssetLibraryMetadataDependencies,
    createEmptyAssetLibraryMetadata,
    loadAssetLibraryMetadata,
    loadAssetLibraryMetadataSnapshot,
    moveAssetLibraryMetadataScope,
    normalizeAssetLibraryLabels,
    normalizeAssetLibraryMetadata,
    parseAssetLibraryLabelInput,
    removeAssetLibraryCollection,
    renameAssetLibraryCollection,
    saveAssetLibraryMetadata,
    setAssetLibraryAssetMetadata,
} from '../assetLibraryMetadata';

function createDependencies(
    readTextFile = vi.fn<(_path: string) => Promise<string>>(),
): AssetLibraryMetadataDependencies {
    return {
        join: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/').replaceAll(/\/+/gu, '/'))),
        mkdir: vi.fn(() => Promise.resolve()),
        readDirectory: vi.fn(() => Promise.resolve([])),
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

        const missingSnapshot = await loadAssetLibraryMetadataSnapshot('/project', dependencies);
        expect(missingSnapshot.metadata).toEqual(createEmptyAssetLibraryMetadata());
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
        }, missingSnapshot, dependencies);

        expect(dependencies.mkdir).toHaveBeenCalledWith('/project/assets', true);
        expect(dependencies.writeTextFile).toHaveBeenCalledWith(
            `/project/assets/${ASSET_LIBRARY_METADATA_FILE_NAME}`,
            expect.stringContaining('"type": "zerith.assetLibrary"'),
            { createOnly: true },
            expect.any(Function),
        );
    });

    it('retains unreadable metadata instead of treating the library as missing', async () => {
        const dependencies = createDependencies(vi.fn().mockRejectedValue(new Error('permission denied')));
        dependencies.readDirectory = vi.fn().mockResolvedValue([{ isFile: true, name: ASSET_LIBRARY_METADATA_FILE_NAME }]);
        await expect(loadAssetLibraryMetadataSnapshot('/project', dependencies)).rejects.toThrow('permission denied');
        expect(dependencies.writeTextFile).not.toHaveBeenCalled();
    });

    it('does not infer a missing library when directory access fails', async () => {
        const dependencies = createDependencies(vi.fn().mockRejectedValue(new Error('denied')));
        dependencies.readDirectory = vi.fn().mockRejectedValue(new Error('directory denied'));
        await expect(loadAssetLibraryMetadataSnapshot('/project', dependencies)).rejects.toThrow('directory denied');
    });

    it('allows creating metadata when the assets directory is confirmed absent', async () => {
        const dependencies = createDependencies(vi.fn().mockRejectedValue(new Error('missing')));
        dependencies.readDirectory = vi.fn().mockRejectedValueOnce(new Error('missing assets')).mockResolvedValueOnce([]);
        const snapshot = await loadAssetLibraryMetadataSnapshot('/project', dependencies);
        await saveAssetLibraryMetadata('/project', snapshot.metadata, snapshot, dependencies);
        expect(dependencies.writeTextFile).toHaveBeenCalledWith(expect.any(String), expect.any(String), { createOnly: true }, expect.any(Function));
    });

    it.each(['{', 'null', '[]', '{"assets":[]}', '{"assets":{"/assets/a":{"tags":"bad"}}}', '{"assets":{},"schemaVersion":2}'])(
        'blocks invalid metadata %s', async text => {
            const dependencies = createDependencies(vi.fn().mockResolvedValue(text));
            await expect(loadAssetLibraryMetadata('/project', dependencies)).rejects.toThrow(/invalid/iu);
            expect(dependencies.writeTextFile).not.toHaveBeenCalled();
        },
    );

    it('checks the original exact bytes and preserves an external edit at the write boundary', async () => {
        let disk = '{ "assets": {} }';
        const dependencies = createDependencies(vi.fn().mockImplementation(() => Promise.resolve(disk)));
        const snapshot = await loadAssetLibraryMetadataSnapshot('/project', dependencies);
        dependencies.writeTextFile = vi.fn<AssetLibraryMetadataDependencies['writeTextFile']>((_path, content, options) => {
            if (options?.expectedContent !== disk) return Promise.reject(new Error('conflict'));
            disk = content;
            return Promise.resolve();
        });
        disk = '{"assets":{"/assets/external":{"tags":["keep"]}}}';
        await expect(saveAssetLibraryMetadata('/project', snapshot.metadata, snapshot, dependencies)).rejects.toThrow('conflict');
        expect(dependencies.readTextFile).toHaveBeenCalledOnce();
        expect(disk).toContain('keep');
        expect(dependencies.writeTextFile).toHaveBeenCalledWith(expect.any(String), expect.any(String), { expectedContent: snapshot.text }, expect.any(Function));
    });

    it('prevents missing-file creation from replacing a newly created library', async () => {
        const dependencies = createDependencies(vi.fn().mockRejectedValue(new Error('missing')));
        const snapshot = await loadAssetLibraryMetadataSnapshot('/project', dependencies);
        dependencies.writeTextFile = vi.fn<AssetLibraryMetadataDependencies['writeTextFile']>((_path, _content, options) => {
            expect(options).toEqual({ createOnly: true });
            return Promise.reject(new Error('already exists'));
        });
        await expect(saveAssetLibraryMetadata('/project', snapshot.metadata, snapshot, dependencies)).rejects.toThrow('already exists');
    });

    it('retires a write queued after path resolution when the session changes', async () => {
        const dependencies = createDependencies();
        const snapshot = { metadata: createEmptyAssetLibraryMetadata(), text: '{"assets":{}}' };
        let current = true;
        dependencies.mkdir = vi.fn(() => { current = false; return Promise.resolve(); });
        await expect(saveAssetLibraryMetadata('/project', snapshot.metadata, snapshot, dependencies, () => current)).rejects.toThrow('Project changed');
        expect(dependencies.writeTextFile).not.toHaveBeenCalled();
    });
});
