import { describe, expect, it, vi } from 'vitest';

import type { AssetImportServiceDependencies } from '../assetImport';

import {
    importAssetFiles,
    importAssetsFromPicker,
    inferAssetImportKind,
    planAssetImports,
} from '../assetImport';

describe('assetImport', () => {
    it('infers asset kinds from extension and filename context', () => {
        expect(inferAssetImportKind('studio-background.png')).toBe('background');
        expect(inferAssetImportKind('aria.png')).toBe('sprite');
        expect(inferAssetImportKind('main-theme.ogg')).toBe('bgm');
        expect(inferAssetImportKind('line-001-voice.wav')).toBe('voice');
        expect(inferAssetImportKind('click.wav')).toBe('sfx');
        expect(inferAssetImportKind('dialogue.json')).toBe('data');
        expect(inferAssetImportKind('ui.woff2')).toBe('font');
        expect(inferAssetImportKind('archive.bin')).toBe('misc');
    });

    it('plans organized asset destinations and resolves collisions case-insensitively', () => {
        const plan = planAssetImports(
            [
                { name: String.raw`C:\Downloads\studio-background.PNG` },
                { name: 'hero.png' },
                { name: 'hero.png' },
                { name: 'bad:name?.wav' },
            ],
            new Map([
                ['assets/bg', ['Studio-Background.PNG']],
                ['assets/sprites', ['hero.png', 'hero_2.png']],
            ]),
        );

        expect(plan).toMatchObject([
            {
                assetUrl: '/assets/bg/studio-background_2.PNG',
                collisionResolved: true,
                kind: 'background',
                sourceName: 'studio-background.PNG',
                targetFolder: 'assets/bg',
                targetName: 'studio-background_2.PNG',
            },
            {
                assetUrl: '/assets/sprites/hero_3.png',
                collisionResolved: true,
                kind: 'sprite',
                targetName: 'hero_3.png',
            },
            {
                assetUrl: '/assets/sprites/hero_4.png',
                collisionResolved: true,
                kind: 'sprite',
                targetName: 'hero_4.png',
            },
            {
                assetUrl: '/assets/sfx/bad_name_.wav',
                collisionResolved: false,
                kind: 'sfx',
                sanitizedName: 'bad_name_.wav',
                targetName: 'bad_name_.wav',
            },
        ]);
    });

    it('copies planned files into project asset folders', async () => {
        const writes: { bytes: Uint8Array; path: string }[] = [];
        const dependencies = createImportDependencies({
            existingNamesByPath: new Map([
                ['/Game/assets/sprites', ['hero.png']],
            ]),
            writes,
        });

        const result = await importAssetFiles('/Game', [
            { bytes: new Uint8Array([1, 2]), name: 'hero.png' },
            { bytes: new Uint8Array([3, 4]), name: 'click.wav' },
        ], {}, dependencies);

        expect(result.imported.map((entry) => entry.assetUrl)).toEqual([
            '/assets/sprites/hero_2.png',
            '/assets/sfx/click.wav',
        ]);
        expect(writes).toEqual([
            { bytes: new Uint8Array([1, 2]), path: '/Game/assets/sprites/hero_2.png' },
            { bytes: new Uint8Array([3, 4]), path: '/Game/assets/sfx/click.wav' },
        ]);
    });

    it('imports files selected by the shared picker', async () => {
        const pickBinaryFiles = vi.fn(() => Promise.resolve([
            { bytes: new Uint8Array([9]), name: 'cover.png' },
        ]));
        const dependencies = createImportDependencies({ pickBinaryFiles });

        const result = await importAssetsFromPicker('/Game', { preferredKind: 'background' }, dependencies);

        expect(pickBinaryFiles).toHaveBeenCalledWith(expect.objectContaining({
            multiple: true,
            title: 'Import assets',
        }));
        expect(result.imported).toMatchObject([
            {
                assetUrl: '/assets/bg/cover.png',
                kind: 'background',
                targetPath: '/Game/assets/bg/cover.png',
            },
        ]);
    });
});

function createImportDependencies({
    existingNamesByPath = new Map(),
    pickBinaryFiles = vi.fn(() => Promise.resolve([])),
    writes = [],
}: {
    existingNamesByPath?: Map<string, string[]>;
    pickBinaryFiles?: AssetImportServiceDependencies['pickBinaryFiles'];
    writes?: { bytes: Uint8Array; path: string }[];
} = {}): AssetImportServiceDependencies {
    return {
        join: (...parts) => Promise.resolve(parts.join('/').replaceAll(/\/+/gu, '/')),
        mkdir: vi.fn(() => Promise.resolve()),
        pickBinaryFiles,
        readDirectory: (path) => Promise.resolve((existingNamesByPath.get(path) ?? []).map((name) => ({ name }))),
        writeBinaryFile: (path, bytes) => {
            writes.push({ bytes, path });
            return Promise.resolve();
        },
    };
}
