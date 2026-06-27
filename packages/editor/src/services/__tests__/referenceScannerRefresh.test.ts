import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { GlobalSearchProjectData } from '../globalSearch';
import type { buildReferenceScannerState as buildReferenceScannerStateType } from '../referenceScanner/refresh';
import type { ReferenceScannerResult } from '../referenceScanner/types';

const projectData: GlobalSearchProjectData = {
    characters: {},
    items: {},
    macros: {},
    manifest: {},
    projectPath: '/project',
    scenes: {},
};

let buildReferenceScannerState: typeof buildReferenceScannerStateType;

beforeAll(async () => {
    vi.stubGlobal('document', {
        createElement: () => ({
            canPlayType: () => 'probably',
        }),
    });
    vi.stubGlobal('window', {});
    ({ buildReferenceScannerState } = await import('../referenceScanner/refresh'));
});

afterAll(() => {
    vi.unstubAllGlobals();
});

describe('referenceScanner refresh', () => {
    it('builds scanner state from project references and asset inventory', async () => {
        const result: ReferenceScannerResult = {
            assetFiles: { '/assets/bg/office.png': [] },
            assets: {},
            characters: {},
            items: {},
            variables: {},
        };
        const collectDataAssetReferences = vi.fn((input: GlobalSearchProjectData, nextResult: ReferenceScannerResult) => {
            expect(input).toBe(projectData);
            nextResult.assetFiles['/assets/items/badge.png'] = [];
            return Promise.resolve();
        });
        const listProjectAssetFiles = vi.fn(() => Promise.resolve([
            '/assets/bg/office.png',
            '/assets/items/badge.png',
        ]));
        const scanReferences = vi.fn(() => result);

        await expect(buildReferenceScannerState(projectData, {
            collectDataAssetReferences,
            listProjectAssetFiles,
            scanReferences,
        })).resolves.toEqual({
            assetInventory: [
                '/assets/bg/office.png',
                '/assets/items/badge.png',
            ],
            result: {
                ...result,
                assetFiles: {
                    '/assets/bg/office.png': [],
                    '/assets/items/badge.png': [],
                },
            },
        });

        expect(scanReferences).toHaveBeenCalledWith(projectData);
        expect(listProjectAssetFiles).toHaveBeenCalledWith('/project');
    });

    it('returns empty scanner state without a project path', async () => {
        const dependencies = {
            collectDataAssetReferences: vi.fn(),
            listProjectAssetFiles: vi.fn(),
            scanReferences: vi.fn(),
        };

        await expect(buildReferenceScannerState({
            ...projectData,
            projectPath: undefined,
        }, dependencies)).resolves.toEqual({
            assetInventory: [],
            result: {
                assetFiles: {},
                assets: {},
                characters: {},
                items: {},
                variables: {},
            },
        });

        expect(dependencies.scanReferences).not.toHaveBeenCalled();
        expect(dependencies.collectDataAssetReferences).not.toHaveBeenCalled();
        expect(dependencies.listProjectAssetFiles).not.toHaveBeenCalled();
    });
});
