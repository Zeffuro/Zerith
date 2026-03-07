import type { ScriptPath } from '../../utils/scriptPathUtils';

export function normalizeNode(node: any): any {
    if (!node || typeof node !== 'object') return node;

    const next = { ...node };

    if (next.type === 'if') {
        if (!Array.isArray(next.then)) next.then = [];
        if (!Array.isArray(next.else)) next.else = [];
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

    if (Array.isArray(next.then)) next.then = next.then.map(normalizeNode);
    if (Array.isArray(next.else)) next.else = next.else.map(normalizeNode);
    if (Array.isArray(next.body)) next.body = next.body.map(normalizeNode);
    if (Array.isArray(next.options)) {
        next.options = next.options.map((opt: any) => ({
            ...opt,
            commands: Array.isArray(opt?.commands) ? opt.commands.map(normalizeNode) : [],
        }));
    }

    return next;
}

export function normalizeScript(script: any[]): any[] {
    return Array.isArray(script) ? script.map(normalizeNode) : [];
}

export function deepClone<T>(value: T): T {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
}

export function isRootIndexPath(p: ScriptPath): p is [number] {
    return p.length === 1 && typeof p[0] === 'number';
}