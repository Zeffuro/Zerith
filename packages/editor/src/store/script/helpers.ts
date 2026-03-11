
import type { EditorNode } from '../../types/EditorNode';
import type { ScriptPath } from '../../utils/scriptPathUtilities';


export function isRootIndexPath(p: ScriptPath): p is [number] {
    return p.length === 1 && typeof p[0] === 'number';
}

export function normalizeNode(node: unknown): unknown {
    if (!node || typeof node !== 'object') return node;

    const next: Record<string, unknown> = { ...(node as Record<string, unknown>) };
    if (next.type === 'if') {
        if (Array.isArray(next.then) && !Array.isArray(next.onTrue)) {
            next.onTrue = next.then;
        }
        if (Array.isArray(next.else) && !Array.isArray(next.onFalse)) {
            next.onFalse = next.else;
        }
        delete next.then;
        delete next.else;
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

    if (Array.isArray(next.onTrue)) next.onTrue = next.onTrue.map((child) => normalizeNode(child));
    if (Array.isArray(next.onFalse)) next.onFalse = next.onFalse.map((child) => normalizeNode(child));
    if (Array.isArray(next.body)) next.body = next.body.map((child) => normalizeNode(child));
    
    // Process options for choice command
    if (next.type === 'choice' && Array.isArray(next.options)) {
        const options = [...(next.options as unknown[])];
        next.options = options.map((option): unknown => {
            if (!option || typeof option !== 'object') return option;
            const optionRecord = option as Record<string, unknown>;
            const commands = Array.isArray(optionRecord.commands)
                ? optionRecord.commands.map((child) => normalizeNode(child))
                : [];
            return { ...optionRecord, commands };
        });
    }

    return next;
}

export function normalizeScript(script: EditorNode[]): EditorNode[] {
    return Array.isArray(script) ? (script.map((node) => normalizeNode(node)) as EditorNode[]) : [];
}
