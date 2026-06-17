import { describe, expect, it, vi } from 'vitest';

import type { ScriptPath } from '../../utils/scriptPathUtilities';
import type { ReferenceScannerResult } from '../referenceScanner';

import '../../test-utils/registerEditorServiceMocks';
import { createGlobalSearchProjectData } from '../../test-utils/projectDataBuilder';
import {
    scanMacroReferences,
    scanProjectScriptBranches,
    scanReferences,
    scanSceneReferences,
} from '../referenceScanner';

function createResult(): ReferenceScannerResult {
    return {
        assetFiles: {},
        assets: {},
        characters: {},
        items: {},
        variables: {},
    };
}

describe('referenceScanner orchestration', () => {
    it('scans scene scripts with resolved or fallback file paths and skips invalid scenes', () => {
        const scanTree = vi.fn<(
            script: unknown,
            path: ScriptPath,
            filePath: string,
            label: string,
            result: ReferenceScannerResult,
        ) => void>();

        const scenes = {
            fallback: [{ type: 'wait' }],
            intro: [{ type: 'wait' }],
            invalid: 'not-an-array',
            missingPath: [{ type: 'wait' }],
        };

        const sceneSources = {
            fallback: { file: 'unknown' },
            intro: 'scripts/intro.json',
        };

        scanSceneReferences('/project', scenes, sceneSources, createResult(), scanTree);

        expect(scanTree).toHaveBeenCalledTimes(2);
        const normalizedCalls = scanTree.mock.calls.map((call) => ({
            filePath: call[2],
            label: call[3],
            path: call[1],
            script: call[0],
        }));

        expect(normalizedCalls).toEqual(expect.arrayContaining([
            {
                filePath: '/project/scripts/intro.json',
                label: 'intro',
                path: [] as ScriptPath,
                script: [{ type: 'wait' }],
            },
            {
                filePath: '/project/game.json',
                label: 'fallback',
                path: [] as ScriptPath,
                script: [{ type: 'wait' }],
            },
        ]));
    });

    it('scans macros in sorted order and uses indexed macro root paths', () => {
        const scanTree = vi.fn();
        const macros = {
            alpha: [{ type: 'wait' }],
            invalid: 'not-an-array',
            zeta: [{ type: 'wait' }],
        };

        scanMacroReferences('/project', macros, 'data/macros.json', createResult(), scanTree);

        expect(scanTree).toHaveBeenCalledTimes(2);
        expect(scanTree).toHaveBeenNthCalledWith(
            1,
            [{ type: 'wait' }],
            [0, 'body'] as ScriptPath,
            '/project/data/macros.json',
            'macro:alpha',
            expect.any(Object),
        );
        expect(scanTree).toHaveBeenNthCalledWith(
            2,
            [{ type: 'wait' }],
            [2, 'body'] as ScriptPath,
            '/project/data/macros.json',
            'macro:zeta',
            expect.any(Object),
        );
    });
});

describe('referenceScanner coordinator', () => {
    it('returns early when project path is unavailable', () => {
        const scanTree = vi.fn();

        scanProjectScriptBranches(
            {
                macros: { greet: [{ type: 'wait' }] },
                manifest: { scenes: { intro: 'scripts/intro.json' } },
                projectPath: undefined,
                scenes: { intro: [{ type: 'wait' }] },
            },
            createResult(),
            scanTree,
        );

        expect(scanTree).not.toHaveBeenCalled();
    });

    it('routes scene and macro scripts through shared traversal using manifest sources', () => {
        const scanTree = vi.fn();

        scanProjectScriptBranches(
            {
                macros: {
                    greet: [{ type: 'wait' }],
                },
                manifest: {
                    macros: 'data/macros.json',
                    scenes: {
                        intro: 'scripts/intro.json',
                    },
                },
                projectPath: '/project',
                scenes: {
                    intro: [{ type: 'wait' }],
                },
            },
            createResult(),
            scanTree,
        );

        expect(scanTree).toHaveBeenCalledTimes(2);
        expect(scanTree).toHaveBeenNthCalledWith(
            1,
            [{ type: 'wait' }],
            [],
            '/project/scripts/intro.json',
            'intro',
            expect.any(Object),
        );
        expect(scanTree).toHaveBeenNthCalledWith(
            2,
            [{ type: 'wait' }],
            [0, 'body'],
            '/project/data/macros.json',
            'macro:greet',
            expect.any(Object),
        );
    });
});

describe('referenceScanner', () => {
    it('collects asset, character, and variable references across scenes and macros', () => {
        const projectData = createGlobalSearchProjectData({
            macros: {
                greet: [{ action: 'show', assetUrl: 'sprites/hero.png', id: 'hero', type: 'sprite' }],
            },
            scenes: {
                intro: [
                    { assetUrl: 'bg/courtroom.png', type: 'background' },
                    { speaker: 'Phoenix', text: 'Status: {caseFlag}', type: 'dialogue' },
                    { key: 'score', op: 'set', type: 'set', value: 1 },
                    { all: [{ key: 'lives' }, { source: 'score' }], key: 'score', type: 'if' },
                    { action: 'add', id: 'attorney_badge', type: 'item' },
                    { key: 'secret_photo', source: 'evidence', type: 'while' },
                ],
            },
        });

        const result = scanReferences(projectData);

        expect(result.assets['bg/courtroom.png']).toHaveLength(1);
        expect(result.assets['bg/courtroom.png'][0]).toMatchObject({
            commandType: 'background',
            filePath: '/project/scripts/intro.json',
            sceneName: 'intro',
        });

        expect(result.assets['sprites/hero.png']).toHaveLength(1);
        expect(result.assets['sprites/hero.png'][0]).toMatchObject({
            commandType: 'sprite',
            filePath: '/project/data/macros.json',
            path: [0, 'body', 0],
            sceneName: 'macro:greet',
        });

        expect(result.characters.Phoenix).toHaveLength(1);

        expect(result.variables.score.writes).toHaveLength(1);
        expect(result.variables.score.inferredType).toBe('number');
        expect(result.variables.score.reads.length).toBeGreaterThanOrEqual(2);

        expect(result.variables.lives.reads).toHaveLength(1);
        expect(result.variables.caseFlag.reads).toHaveLength(1);
        expect(result.items.attorney_badge).toHaveLength(1);
        expect(result.items.secret_photo).toHaveLength(1);
    });

    it('returns an empty reference set when project path is unavailable', () => {
        const result = scanReferences(createGlobalSearchProjectData({ projectPath: undefined }));

        expect(result).toEqual({
            assetFiles: {},
            assets: {},
            characters: {},
            items: {},
            variables: {},
        });
    });
});

