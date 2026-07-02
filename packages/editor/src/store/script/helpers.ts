import { SchemaRegistry } from '@zeffuro/zerith-core/schemas';
import { z } from 'zod';

import type { EditorNode } from '../../types/EditorNode';
import type { ScriptPath } from '../../utils/scriptPathUtilities';

import { isRecord } from '../../utils/typeGuards';


export function isRootIndexPath(p: ScriptPath): p is [number] {
    return p.length === 1 && typeof p[0] === 'number';
}

export function normalizeNode(node: unknown): unknown {
    if (!isRecord(node)) return node;

    const next: Record<string, unknown> = { ...node };
    applyLegacyIfMigration(next);
    applySchemaDefaults(next);
    applyCompatibilityDefaults(next);
    applyRecursiveBranchNormalization(next);
    applyChoiceOptionNormalization(next);
    return next;
}

export function normalizeScript(script: EditorNode[]): EditorNode[] {
    return Array.isArray(script) ? (script.map((node) => normalizeNode(node)) as EditorNode[]) : [];
}

function applyChoiceOptionNormalization(next: Record<string, unknown>): void {
    if (next.type !== 'choice' || !Array.isArray(next.options)) return;
    next.options = next.options.map((option): unknown => {
        if (!isRecord(option)) return option;
        const commands = Array.isArray(option.commands)
            ? option.commands.map((child) => normalizeNode(child))
            : [];
        return { ...option, commands };
    });
}

function applyCompatibilityDefaults(next: Record<string, unknown>): void {
    if (next.type === 'if') {
        if (!Array.isArray(next.onTrue)) next.onTrue = [];
        if (!Array.isArray(next.onFalse)) next.onFalse = [];
    }

    if (next.type === 'while') {
        if (!Array.isArray(next.body)) next.body = [];
        if (next.op === undefined) next.op = 'eq';
        if (next.source === undefined) next.source = 'variable';
    }

    if (next.type === 'for') {
        if (!Array.isArray(next.body)) next.body = [];
        if (next.iterator === undefined) next.iterator = 'i';
        if (next.from === undefined) next.from = 0;
        if (next.to === undefined) next.to = 0;
        if (next.step === undefined || next.step === 0) next.step = 1;
    }
}

function applyLegacyIfMigration(next: Record<string, unknown>): void {
    if (next.type !== 'if') return;
    if (Array.isArray(next.then) && !Array.isArray(next.onTrue)) {
        next.onTrue = next.then;
    }
    if (Array.isArray(next.else) && !Array.isArray(next.onFalse)) {
        next.onFalse = next.else;
    }
    delete next.then;
    delete next.else;
}

function applyRecursiveBranchNormalization(next: Record<string, unknown>): void {
    if (Array.isArray(next.onTrue)) next.onTrue = next.onTrue.map((child) => normalizeNode(child));
    if (Array.isArray(next.onFalse)) next.onFalse = next.onFalse.map((child) => normalizeNode(child));
    if (Array.isArray(next.body)) next.body = next.body.map((child) => normalizeNode(child));
}

function applySchemaDefaults(next: Record<string, unknown>): void {
    const type = typeof next.type === 'string' ? next.type : undefined;
    if (!type) return;

    const schema = SchemaRegistry.get(type);
    const objectSchema = schema ? getZodObjectSchema(schema) : undefined;
    if (!objectSchema) return;

    for (const [fieldKey, rawFieldSchema] of Object.entries(objectSchema.shape)) {
        if (fieldKey === 'type' || next[fieldKey] !== undefined) continue;
        const defaultValue = getSchemaDefaultValue(rawFieldSchema as unknown as z.ZodTypeAny);
        if (defaultValue !== undefined) {
            next[fieldKey] = defaultValue;
        }
    }
}

function getSchemaDefaultValue(schema: z.ZodTypeAny): unknown {
    let current = schema;
    while (true) {
        if (current instanceof z.ZodDefault) {
            const parsed = current.safeParse(void 0);
            return parsed.success ? parsed.data : undefined;
        }
        if (
            current instanceof z.ZodOptional
            || current instanceof z.ZodNullable
            || current instanceof z.ZodReadonly
        ) {
            current = current.unwrap() as z.ZodTypeAny;
            continue;
        }
        return undefined;
    }
}

function getZodObjectSchema(schema: z.ZodTypeAny): undefined | z.ZodObject<z.ZodRawShape> {
    let current = schema;
    while (true) {
        if (current instanceof z.ZodObject) {
            return current;
        }
        if (
            current instanceof z.ZodDefault
            || current instanceof z.ZodOptional
            || current instanceof z.ZodNullable
            || current instanceof z.ZodReadonly
        ) {
            current = current.unwrap() as z.ZodTypeAny;
            continue;
        }
        return undefined;
    }
}

