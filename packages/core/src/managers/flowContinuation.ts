import type { BaseCommand, RuntimeEntry, Script } from '../types';

import { SchemaRegistry } from '../schemas';

export type FlowContinuation = {
    injectedCommands: BaseCommand[];
    replay?: PresentationReplay;
} & SceneContinuation;
export type PreparedSceneRestore = {
    index: number;
    runtimeScript: RuntimeEntry[];
    sceneName: string;
    sourceFingerprint: string;
};
export type PresentationReplay = { command: BaseCommand; kind: 'choice' | 'dialogue' };
export type SceneContinuation = {
    nextIndex: number;
    runtimeScript: RuntimeEntry[];
    sourceFingerprint: string;
};

const MAX_COMMANDS = 50_000;
const MAX_DEPTH = 64;
const MAX_NODES = 200_000;
const MAX_BYTES = 4 * 1024 * 1024;

export function canonicalContinuationJson(value: unknown): string {
    return JSON.stringify(value, (_, entry: unknown) => isRecord(entry)
        ? Object.fromEntries(Object.entries(entry).toSorted(([a], [b]) => compareKeys(a, b)))
        : entry);
}

export function isCursor(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function parseFlowContinuation(value: unknown): FlowContinuation | undefined {
    try {
        if (!isBoundedJson(value) || !isRecord(value)) return;
        const { injectedCommands, nextIndex, replay, runtimeScript, sourceFingerprint } = value;
        if (!Array.isArray(runtimeScript) || !Array.isArray(injectedCommands)
            || runtimeScript.length + injectedCommands.length > MAX_COMMANDS
            || !isCursor(nextIndex) || nextIndex > runtimeScript.length
            || typeof sourceFingerprint !== 'string' || sourceFingerprint.length === 0) return;
        if (!runtimeScript.every(isRuntimeEntry) || !injectedCommands.every(isCommand)) return;
        if (replay !== undefined && (!isRecord(replay) || !isCommand(replay.command)
            || (replay.kind !== 'choice' && replay.kind !== 'dialogue') || replay.command.type !== replay.kind)) return;
        const json = JSON.stringify({ injectedCommands, nextIndex, ...(replay ? { replay } : {}), runtimeScript, sourceFingerprint });
        return JSON.parse(json) as FlowContinuation;
    } catch {
        return;
    }
}

export function sourceFingerprint(script: Script, templates: [string, Script][]): string {
    return canonicalContinuationJson([script, templates.toSorted(([a], [b]) => compareKeys(a, b))]);
}

function compareKeys(a: string, b: string): number {
    return a < b ? -1 : (a > b ? 1 : 0);
}

function isBoundedJson(value: unknown): boolean {
    let nodes = 0;
    let commands = 0;
    let loopSteps = 0;
    const spendLoopStep = () => ++loopSteps + nodes <= MAX_NODES;
    const ancestors = new Set<unknown>();
    const visit = (entry: unknown, depth: number): boolean => {
        if (++nodes + loopSteps > MAX_NODES || depth > MAX_DEPTH) return false;
        if (entry === null || typeof entry === 'boolean') return true;
        if (typeof entry === 'number') return Number.isFinite(entry);
        if (typeof entry === 'string') return entry.length <= MAX_BYTES;
        if (typeof entry !== 'object' || ancestors.has(entry)) return false;
        if (!Array.isArray(entry) && (!isRecord(entry) || Object.getPrototypeOf(entry) !== Object.prototype)) return false;
        if (Object.getOwnPropertySymbols(entry).length > 0) return false;
        const keys = Object.keys(entry);
        if (Array.isArray(entry) && keys.length !== entry.length) return false;
        if (Object.getOwnPropertyNames(entry).length !== keys.length + (Array.isArray(entry) ? 1 : 0)) return false;
        if (keys.some(key => !Object.hasOwn(Object.getOwnPropertyDescriptor(entry, key) ?? {}, 'value'))) return false;
        const values = Array.isArray(entry) ? entry : Object.values(entry).filter(child => child !== undefined);
        if (values.length > MAX_NODES - nodes) return false;
        if (isRecord(entry) && typeof entry.type === 'string' && (++commands > MAX_COMMANDS || !isSafeLoop(entry, spendLoopStep))) return false;
        ancestors.add(entry);
        const valid = values.every(child => visit(child, depth + 1));
        ancestors.delete(entry);
        return valid;
    };
    return visit(value, 0) && new TextEncoder().encode(JSON.stringify(value)).length <= MAX_BYTES;
}

function isCommand(value: unknown): value is BaseCommand {
    if (!isRecord(value) || typeof value.type !== 'string' || value.type.trim().length === 0 || value.type.length > 128) return false;
    if (!SchemaRegistry.getCommandSchema().safeParse(value).success) return false;
    return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRuntimeEntry(value: unknown): value is RuntimeEntry {
    return isRecord(value) && isCommand(value.command)
        && (value.kind === 'injected' || (value.kind === 'original' && isCursor(value.originalIndex)));
}

function isSafeLoop(value: Record<string, unknown>, spendStep: () => boolean): boolean {
    if (value.type === 'for') {
        const from = Number(value.from ?? 0);
        const to = Number(value.to ?? 0);
        const step = Number(value.step ?? 1);
        if (!Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(step) || step === 0) return false;
        const bodyLength = Array.isArray(value.body) ? value.body.length : 0;
        let iterations = 0;
        for (let cursor = from; step > 0 ? cursor <= to : cursor >= to;) {
            if (!spendStep()) return false;
            if (++iterations * (bodyLength + 1) > MAX_COMMANDS) return false;
            const next = cursor + step;
            if (next === cursor) return false;
            cursor = next;
        }
    }
    if (value.type === 'while' && value.maxIterations !== undefined
        && (!isCursor(value.maxIterations) || value.maxIterations === 0 || value.maxIterations > MAX_COMMANDS)) return false;
    return true;
}
