import { describe, expect, it, vi } from 'vitest';

import type { ReferenceScannerResult } from '../referenceScanner';
import type { ScriptPath } from '../../utils/scriptPathUtilities';

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
        const scanTree = vi.fn();

        const scenes = {
            intro: [{ type: 'wait' }],
            fallback: [{ type: 'wait' }],
            missingPath: [{ type: 'wait' }],
            invalid: 'not-an-array',
        };

        const sceneSources = {
            intro: 'scripts/intro.json',
            fallback: { file: 'unknown' },
        };

        scanSceneReferences('/project', scenes, sceneSources, createResult(), scanTree);

        expect(scanTree).toHaveBeenCalledTimes(2);
        expect(scanTree).toHaveBeenNthCalledWith(
            1,
            [{ type: 'wait' }],
            [] as ScriptPath,
            '/project/scripts/intro.json',
            'intro',
            expect.any(Object),
        );
        expect(scanTree).toHaveBeenNthCalledWith(
            2,
            [{ type: 'wait' }],
            [] as ScriptPath,
            '/project/game.json',
            'fallback',
            expect.any(Object),
        );
    });

    it('scans macros in sorted order and uses indexed macro root paths', () => {
        const scanTree = vi.fn();
        const macros = {
            zeta: [{ type: 'wait' }],
            alpha: [{ type: 'wait' }],
            invalid: 'not-an-array',
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

