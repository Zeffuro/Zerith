import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { ReferenceLocation, VariableReferenceStats } from '../referenceScanner';

import { resolveFilePath, resolveScenePath } from '../referenceScanner/paths';
import { getCommandFieldHints, unwrapObjectSchema } from '../referenceScanner/schemaHints';
import {
    extractTemplateVariables,
    mergeInferredType,
    pushVariableRead,
    pushVariableWrite,
} from '../referenceScanner/variables';

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

    it('unwraps nested object wrappers and returns undefined for non-object schemas', () => {
        const wrappedObject = z.object({ key: z.string() }).optional().nullable().default({ key: 'x' });
        const objectSchema = unwrapObjectSchema(wrappedObject);
        expect(objectSchema).toBeDefined();
        expect(objectSchema?.shape).toHaveProperty('key');

        const nonObject = z.string().optional();
        expect(unwrapObjectSchema(nonObject)).toBeUndefined();
    });
});

