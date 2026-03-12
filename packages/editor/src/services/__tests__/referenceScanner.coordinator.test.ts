import { describe, expect, it, vi } from 'vitest';

import type { ReferenceScannerResult } from '../referenceScanner';

import { scanProjectScriptBranches } from '../referenceScanner/index';

function createResult(): ReferenceScannerResult {
    return {
        assets: {},
        characters: {},
        variables: {},
    };
}

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

