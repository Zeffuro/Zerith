import { describe, expect, it, vi } from 'vitest';

import type { ScriptPath } from '../../utils/scriptPathUtilities';
import type { ReferenceScannerResult } from '../referenceScanner';

import { scanMacroReferences, scanSceneReferences } from '../referenceScanner/orchestration';

function createResult(): ReferenceScannerResult {
    return {
        assets: {},
        characters: {},
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

