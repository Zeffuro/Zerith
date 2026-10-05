import type { EditorNode } from '../types/EditorNode';

import { normalizeScript } from '../store/script/helpers';
import { isRecord } from '../utils/typeGuards';

export function scriptMatchesSavedBaseline(source: string | undefined, rootScript: EditorNode[], macroEntries: { commands: EditorNode[]; name: string }[], editingAllMacros: boolean, activeMacro?: string): boolean {
    if (source === undefined) return false;
    try {
        const data = JSON.parse(source) as unknown;
        if (editingAllMacros) {
            if (!isRecord(data)) return false;
            const saved = Object.entries(data).filter(([name]) => !name.startsWith('$')).map(([name, commands]) => ({ commands, name })).toSorted((a, b) => a.name.localeCompare(b.name));
            const current = macroEntries.toSorted((a, b) => a.name.localeCompare(b.name));
            return saved.length === current.length && saved.every((entry, index) => entry.name === current[index].name && sameScript(entry.commands, current[index].commands));
        }
        const commands = isRecord(data) ? (activeMacro ? data[activeMacro] : data.commands) : data;
        return sameScript(commands, rootScript);
    } catch {
        return false;
    }
}

function canonical(value: unknown): string {
    return JSON.stringify(value, (_, entry: unknown) => isRecord(entry)
        ? Object.fromEntries(Object.entries(entry).toSorted(([a], [b]) => a.localeCompare(b))) : entry);
}

function sameScript(saved: unknown, current: EditorNode[]): boolean {
    return Array.isArray(saved) && canonical(normalizeScript(saved as EditorNode[])) === canonical(normalizeScript(current));
}
