import { describe, expect, it, vi } from 'vitest';

import type { ReferenceScannerResult } from '../referenceScanner';
import type { ScriptPath } from '../../utils/scriptPathUtilities';

import { scanReferenceTree } from '../referenceScanner/treeScan';

function createResult(): ReferenceScannerResult {
    return {
        assets: {},
        characters: {},
        variables: {},
    };
}

describe('referenceScanner tree scan', () => {
    it('traverses nested arrays/objects and forwards command paths', () => {
        const scanCommand = vi.fn();
        const script = [
            {
                children: [
                    { type: 'dialogue' },
                    { node: { type: 'set' } },
                ],
                type: 'if',
            },
        ];

        scanReferenceTree(script, [], '/project/scripts/intro.json', 'intro', createResult(), scanCommand);

        expect(scanCommand).toHaveBeenCalledTimes(3);
        expect(scanCommand).toHaveBeenNthCalledWith(
            1,
            { children: [{ type: 'dialogue' }, { node: { type: 'set' } }], type: 'if' },
            'if',
            [0] as ScriptPath,
            '/project/scripts/intro.json',
            'intro',
            expect.any(Object),
        );
        expect(scanCommand).toHaveBeenNthCalledWith(
            2,
            { type: 'dialogue' },
            'dialogue',
            [0, 'children', 0] as ScriptPath,
            '/project/scripts/intro.json',
            'intro',
            expect.any(Object),
        );
        expect(scanCommand).toHaveBeenNthCalledWith(
            3,
            { type: 'set' },
            'set',
            [0, 'children', 1, 'node'] as ScriptPath,
            '/project/scripts/intro.json',
            'intro',
            expect.any(Object),
        );
    });

    it('skips non-record values and records without a string type', () => {
        const scanCommand = vi.fn();

        scanReferenceTree([null, 1, 'x', { type: 9 }, { type: 'wait' }], [], '/project/scripts/intro.json', 'intro', createResult(), scanCommand);

        expect(scanCommand).toHaveBeenCalledTimes(1);
        expect(scanCommand).toHaveBeenCalledWith(
            { type: 'wait' },
            'wait',
            [4],
            '/project/scripts/intro.json',
            'intro',
            expect.any(Object),
        );
    });
});

