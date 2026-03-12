import { describe, expect, it } from 'vitest';

import { normalizeNode, normalizeScript } from '../helpers';

function createLegacyIfNode(children: unknown[] = []): Record<string, unknown> {
    return JSON.parse(`{"type":"if","then":${JSON.stringify(children)}}`) as Record<string, unknown>;
}

describe('normalizeNode', () => {
    it('migrates legacy if branches and normalizes nested branch commands', () => {
        const nestedIf = createLegacyIfNode([{ duration: 1, type: 'wait' }]);
        const legacyRoot = createLegacyIfNode([{ body: [nestedIf], from: 1, step: 0, to: 3, type: 'for' }]);
        legacyRoot.else = [{ type: 'while' }];
        const normalized = normalizeNode(legacyRoot) as Record<string, unknown>;

        expect(normalized.then).toBeUndefined();
        expect(normalized.else).toBeUndefined();
        expect(Array.isArray(normalized.onTrue)).toBe(true);
        expect(Array.isArray(normalized.onFalse)).toBe(true);

        const normalizedFor = (normalized.onTrue as Array<Record<string, unknown>>)[0];
        expect(normalizedFor.iterator).toBe('i');
        expect(normalizedFor.step).toBe(1);

        const nestedIfCommand = (normalizedFor.body as Array<Record<string, unknown>>)[0];
        expect(Array.isArray(nestedIfCommand.onTrue)).toBe(true);
        expect(Array.isArray(nestedIfCommand.onFalse)).toBe(true);

        const normalizedWhile = (normalized.onFalse as Array<Record<string, unknown>>)[0];
        expect(normalizedWhile.body).toEqual([]);
        expect(normalizedWhile.op).toBe('eq');
        expect(normalizedWhile.source).toBe('variable');
    });

    it('normalizes choice options and ensures commands arrays are present', () => {
        const normalized = normalizeNode({
            options: [
                { commands: [createLegacyIfNode()], label: 'A' },
                { label: 'B' },
            ],
            type: 'choice',
        }) as Record<string, unknown>;

        const options = normalized.options as Array<Record<string, unknown>>;
        expect(options).toHaveLength(2);
        expect(options[1].commands).toEqual([]);

        const firstOptionFirstCommand = (options[0].commands as Array<Record<string, unknown>>)[0];
        expect(firstOptionFirstCommand.onTrue).toEqual([]);
        expect(firstOptionFirstCommand.onFalse).toEqual([]);
    });

    it('returns non-record values as-is', () => {
        expect(normalizeNode(42)).toBe(42);
        expect(normalizeNode('text')).toBe('text');
        expect(normalizeNode(false)).toBe(false);
    });

    it('normalizes each node when normalizing a script array', () => {
        const normalized = normalizeScript([
            createLegacyIfNode() as never,
            { type: 'while' } as never,
        ]);

        expect(normalized).toHaveLength(2);
        expect((normalized[0] as Record<string, unknown>).onTrue).toEqual([]);
        expect((normalized[0] as Record<string, unknown>).onFalse).toEqual([]);
        expect((normalized[1] as Record<string, unknown>).body).toEqual([]);
    });
});

