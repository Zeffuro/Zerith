import { validateScript } from 'core/schemas';

import { executeProjectOpenAction } from '../store/actions/projectOpenActions';

export function applyAssetSelection(assetPath: string) {
    executeProjectOpenAction({ action: 'applyAssetSelection', assetPath });
}

export function applyMacrosFile(path: string, object: Record<string, any>) {
    const keys = Object.keys(object).filter((k) => Array.isArray(object[k]));
    const entries = keys
        .map((name) => ({ commands: validateScript(object[name]), name }))
        .sort((a, b) => a.name.localeCompare(b.name));

    executeProjectOpenAction({ action: 'applyMacrosFile', entries, path });
}

export function applyScriptFile(path: string, data: any[]) {
    const validScript = validateScript(data);
    executeProjectOpenAction({ action: 'applyScriptFile', path, script: validScript });
}

export function looksLikeMacrosObject(data: any): data is Record<string, any> {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    const keys = Object.keys(data);
    if (keys.length === 0) return false;
    return keys.every((k) => Array.isArray((data)[k]));
}