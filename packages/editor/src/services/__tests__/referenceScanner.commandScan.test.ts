import { describe, expect, it } from 'vitest';

import type { ReferenceScannerResult } from '../referenceScanner';

import { scanCommandReferences } from '../referenceScanner/commandScan';

function createResult(): ReferenceScannerResult {
    return {
        assets: {},
        characters: {},
        variables: {},
    };
}

describe('referenceScanner command scan', () => {
    it('collects asset and speaker references via schema hints', () => {
        const result = createResult();

        scanCommandReferences(
            { assetUrl: 'bg/courtroom.png', type: 'background' },
            'background',
            [0],
            '/project/scripts/intro.json',
            'intro',
            result,
        );

        scanCommandReferences(
            { speaker: 'Phoenix', text: 'Hello', type: 'dialogue' },
            'dialogue',
            [1],
            '/project/scripts/intro.json',
            'intro',
            result,
        );

        expect(result.assets['bg/courtroom.png']).toHaveLength(1);
        expect(result.characters.Phoenix).toHaveLength(1);
    });

    it('tracks set writes with inferred type and avoids generic key-field read for set', () => {
        const result = createResult();

        scanCommandReferences(
            { key: 'score', op: 'set', type: 'set', value: 1 },
            'set',
            [0],
            '/project/scripts/intro.json',
            'intro',
            result,
        );

        expect(result.variables.score.writes).toHaveLength(1);
        expect(result.variables.score.inferredType).toBe('number');
        expect(result.variables.score.reads).toHaveLength(0);
    });

    it('tracks reads from if/while conditions and dialogue templates', () => {
        const result = createResult();

        scanCommandReferences(
            {
                all: [{ key: 'lives' }, { source: 'score' }],
                any: [{ key: 'flag' }],
                key: 'score',
                type: 'if',
            },
            'if',
            [0],
            '/project/scripts/intro.json',
            'intro',
            result,
        );

        scanCommandReferences(
            { text: 'Status {flag} / {lives}', type: 'dialogue' },
            'dialogue',
            [1],
            '/project/scripts/intro.json',
            'intro',
            result,
        );

        expect(result.variables.score.reads.length).toBeGreaterThanOrEqual(1);
        expect(result.variables.lives.reads.length).toBeGreaterThanOrEqual(2);
        expect(result.variables.flag.reads.length).toBeGreaterThanOrEqual(2);
    });
});

