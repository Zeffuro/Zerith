import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { ScriptPath } from '../../utils/scriptPathUtilities';
import type {
    AssetUsageEntry,
    ReferenceLocation,
    ReferenceScannerResult,
    VariableReferenceStats,
} from '../referenceScanner';

import { createAssetDependencyGraph, normalizeAssetReference } from '../referenceScanner/assets';
import { scanCommandReferences } from '../referenceScanner/commandScan';
import { resolveFilePath, resolveScenePath } from '../referenceScanner/paths';
import { getCommandFieldHints, unwrapObjectSchema } from '../referenceScanner/schemaHints';
import { scanReferenceTree } from '../referenceScanner/treeScan';
import {
    extractTemplateVariables,
    mergeInferredType,
    pushVariableRead,
    pushVariableWrite,
} from '../referenceScanner/variables';

function createResult(): ReferenceScannerResult {
    return {
        assetFiles: {},
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

        scanReferenceTree([undefined, 1, 'x', { type: 9 }, { type: 'wait' }], [], '/project/scripts/intro.json', 'intro', createResult(), scanCommand);

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
        expect(result.assetFiles['/assets/bg/courtroom.png']).toHaveLength(1);
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

describe('referenceScanner helpers', () => {
    it('resolves manifest file paths for relative and rooted values', () => {
        expect(resolveFilePath('/project', 'scripts/intro.json')).toBe('/project/scripts/intro.json');
        expect(resolveFilePath('/project', '/data/macros.json')).toBe('/project/data/macros.json');
        expect(resolveFilePath('/project')).toBe('/project/game.json');
    });

    it('resolves scene sources and falls back to game manifest path', () => {
        expect(resolveScenePath('/project', 'intro', { intro: 'scripts/intro.json' })).toBe('/project/scripts/intro.json');
        expect(resolveScenePath('/project', 'intro', { intro: { nested: true } })).toBe('/project/game.json');
        expect(resolveScenePath('/project', 'missing', { intro: 'scripts/intro.json' })).toBeUndefined();
    });

    it('extracts unique template variable names from dialogue text', () => {
        expect(extractTemplateVariables('Hello {name}, score {score}, again {name}.')).toEqual(['name', 'score']);
        expect(extractTemplateVariables('No templates here')).toEqual([]);
    });

    it('tracks variable reads and writes and upgrades inferred type to mixed when conflicting', () => {
        const variables: Record<string, VariableReferenceStats> = {};
        const location: ReferenceLocation = {
            commandType: 'set',
            filePath: '/project/scripts/intro.json',
            path: [0],
            sceneName: 'intro',
        };

        pushVariableRead(variables, 'score', location);
        pushVariableWrite(variables, 'score', location);
        mergeInferredType(variables, 'score', 'number');
        mergeInferredType(variables, 'score', 'string');

        expect(variables.score.reads).toHaveLength(1);
        expect(variables.score.writes).toHaveLength(1);
        expect(variables.score.inferredType).toBe('mixed');
    });

    it('classifies command schema hint fields for known and unknown command types', () => {
        const backgroundHints = getCommandFieldHints('background');
        expect(backgroundHints.assetFields).toContain('assetUrl');

        const dialogueHints = getCommandFieldHints('dialogue');
        expect(dialogueHints.speakerFields).toContain('speaker');

        const unknownHints = getCommandFieldHints('unknown-command-type');
        expect(unknownHints).toEqual({ assetFields: [], keyFields: [], speakerFields: [] });
    });

    it('normalizes asset references for dependency matching', () => {
        expect(normalizeAssetReference('/assets/bg/office.png')).toBe('/assets/bg/office.png');
        expect(normalizeAssetReference('bg/office.png')).toBe('/assets/bg/office.png');
        expect(normalizeAssetReference('/assets/bgm/court.mp3:loop')).toBe('/assets/bgm/court.mp3');
        expect(normalizeAssetReference('https://example.com/bg.png')).toBeUndefined();
    });

    it('builds used, unused, and missing sets for asset dependency graph', () => {
        const dependencyGraph = createAssetDependencyGraph(
            {
                '/assets/bg/office.png': [{ commandType: 'background', filePath: '/project/scripts/intro.json', path: [0], sceneName: 'intro' }],
                '/assets/sfx/missing.wav': [{ commandType: 'sfx', filePath: '/project/scripts/intro.json', path: [1], sceneName: 'intro' }],
            },
            ['/assets/bg/office.png', '/assets/bg/courtroom.png'],
        );

        expect(dependencyGraph.used.map((entry: AssetUsageEntry) => entry.assetUrl)).toEqual([
            '/assets/bg/office.png',
            '/assets/sfx/missing.wav',
        ]);
        expect(dependencyGraph.unused).toEqual(['/assets/bg/courtroom.png']);
        expect(dependencyGraph.missing.map((entry: AssetUsageEntry) => entry.assetUrl)).toEqual(['/assets/sfx/missing.wav']);
    });

    it('unwraps nested object wrappers and returns undefined for non-object schemas', () => {
        const wrappedObject = z.object({ key: z.string() }).optional().nullable().default({ key: 'x' });
        const objectSchema = unwrapObjectSchema(wrappedObject);
        expect(objectSchema).toBeDefined();
        expect(objectSchema?.shape).toHaveProperty('key');

        const nonObject = z.string().optional();
        expect(unwrapObjectSchema(nonObject)).toBeUndefined();
    });
});

