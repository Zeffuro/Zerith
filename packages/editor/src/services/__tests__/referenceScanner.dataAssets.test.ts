import { describe, expect, it, vi } from 'vitest';

import type { ReferenceScannerResult } from '../referenceScanner';

import { createGlobalSearchProjectData } from '../../test-utils/projectDataBuilder';
import { collectDataAssetReferences } from '../referenceScanner/assets';

const fsMocks = vi.hoisted(() => ({
    fsReadTextFile: vi.fn<(_path: string) => Promise<string>>(),
}));

vi.mock('../fs', async () => {
    const actual = await vi.importActual<typeof import('../fs')>('../fs');
    return {
        ...actual,
        fsReadTextFile: fsMocks.fsReadTextFile,
    };
});

function createResult(): ReferenceScannerResult {
    return {
        assetFiles: {},
        assets: {},
        characters: {},
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
});

