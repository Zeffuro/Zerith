import { validateScript } from 'core/schemas';

import { executeProjectOpenAction } from '../store/actions/projectOpenActions';
import { isRecord } from '../utils/typeGuards';

export function applyAssetSelection(assetPath: string) {
    executeProjectOpenAction({ action: 'applyAssetSelection', assetPath });
}

export function applyMacrosFile(path: string, object: Record<string, unknown>) {
    const keys = Object.keys(object).filter((key) => Array.isArray(object[key]));
    const entries = keys
        .map((name) => ({ commands: validateScript(object[name] as unknown[]), name }))
        .toSorted((a, b) => a.name.localeCompare(b.name));

    executeProjectOpenAction({ action: 'applyMacrosFile', entries, path });
}

export function applyScriptFile(path: string, data: unknown[]) {
    const validScript = validateScript(data);
    executeProjectOpenAction({ action: 'applyScriptFile', path, script: validScript });
}

export function looksLikeMacrosObject(data: unknown): data is Record<string, unknown> {
    if (!isRecord(data)) return false;
    const entries = Object.entries(data);
    if (entries.length === 0) return false;

    const macroEntries = entries.filter(([key]) => !key.startsWith('$'));
    if (macroEntries.length === 0) return false;

    return macroEntries.every(([, value]) => Array.isArray(value));
}