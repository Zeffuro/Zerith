import { describe, expect, it, vi } from 'vitest';

import type { ReferenceScannerResult } from '../referenceScanner';

import { createGlobalSearchProjectData } from '../../test-utils/projectDataBuilder';
import { collectDataAssetReferences, listProjectAssetFiles } from '../referenceScanner/assets';

const fsMocks = vi.hoisted(() => ({
    fsJoin: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/').replaceAll(/\/+/gu, '/'))),
    fsReadDirectory: vi.fn<(_path: string) => Promise<Array<{ isDirectory: boolean; isFile: boolean; isSymlink: boolean; name: string }>>>(),
    fsReadTextFile: vi.fn<(_path: string) => Promise<string>>(),
}));

vi.mock('../fs', async () => {
    const actual = await vi.importActual<typeof import('../fs')>('../fs');
    return {
        ...actual,
        fsJoin: fsMocks.fsJoin,
        fsReadDirectory: fsMocks.fsReadDirectory,
        fsReadTextFile: fsMocks.fsReadTextFile,
    };
});

function createResult(): ReferenceScannerResult {
    return {
        assetFiles: {},
        assets: {},
        characters: {},
        items: {},
        variables: {},
    };
}

describe('referenceScanner data asset enrichment', () => {
    it('collects item images and character spritesheet descriptor/source assets', async () => {
        fsMocks.fsReadTextFile.mockResolvedValueOnce('{"format":"atlas","source":"phoenixsheet.png"}');

        const projectData = createGlobalSearchProjectData({
            characters: {
                phoenix: {
                    displayName: 'Phoenix Wright',
                    name: 'phoenix',
                    spritesheet: { atlasUrl: '/assets/sprites/phoenixsheet.sheet.json' },
                },
            },
            items: {
                badge: {
                    description: 'Badge',
                    imageUrl: '/assets/items/badge.png',
                    name: 'Attorney Badge',
                },
            },
        });
        const result = createResult();

        await collectDataAssetReferences(projectData, result);

        expect(result.assetFiles['/assets/items/badge.png']).toHaveLength(1);
        expect(result.assetFiles['/assets/sprites/phoenixsheet.sheet.json']).toHaveLength(1);
        expect(result.assetFiles['/assets/sprites/phoenixsheet.png']).toHaveLength(1);
        expect(result.assetFiles['/assets/sprites/phoenixsheet.png'][0]).toMatchObject({
            commandType: 'character.spritesheet.source',
            sceneName: 'data:characters',
        });
    });

    it('resolves relative descriptor source paths against descriptor location', async () => {
        fsMocks.fsReadTextFile.mockResolvedValueOnce('{"format":"atlas","source":"../phoenixsheet.png"}');

        const projectData = createGlobalSearchProjectData({
            characters: {
                phoenix: {
                    displayName: 'Phoenix Wright',
                    name: 'phoenix',
                    spritesheet: { atlasUrl: '/assets/sprites/actors/phoenixsheet.sheet.json' },
                },
            },
            items: {},
        });
        const result = createResult();

        await collectDataAssetReferences(projectData, result);

        expect(result.assetFiles['/assets/sprites/phoenixsheet.png']).toHaveLength(1);
    });

    it('keeps atlas references when descriptor source cannot be read', async () => {
        fsMocks.fsReadTextFile.mockRejectedValueOnce(new Error('missing file'));

        const projectData = createGlobalSearchProjectData({
            characters: {
                phoenix: {
                    displayName: 'Phoenix Wright',
                    name: 'phoenix',
                    spritesheet: { atlasUrl: '/assets/sprites/phoenixsheet.sheet.json' },
                },
            },
            items: {},
        });
        const result = createResult();

        await collectDataAssetReferences(projectData, result);

        expect(result.assetFiles['/assets/sprites/phoenixsheet.sheet.json']).toHaveLength(1);
        expect(result.assetFiles['/assets/sprites/phoenixsheet.png']).toBeUndefined();
    });

    it('skips the asset library metadata file when listing project assets', async () => {
        fsMocks.fsReadDirectory.mockImplementation((path) => {
            if (path === '/project/assets') {
                return Promise.resolve([
                    { isDirectory: false, isFile: true, isSymlink: false, name: '.zerith-library.json' },
                    { isDirectory: true, isFile: false, isSymlink: false, name: 'bg' },
                    { isDirectory: false, isFile: true, isSymlink: false, name: 'loose.png' },
                ]);
            }

            if (path === '/project/assets/bg') {
                return Promise.resolve([
                    { isDirectory: false, isFile: true, isSymlink: false, name: 'office.png' },
                ]);
            }

            return Promise.resolve([]);
        });

        await expect(listProjectAssetFiles('/project')).resolves.toEqual([
            '/assets/bg/office.png',
            '/assets/loose.png',
        ]);
    });
});

