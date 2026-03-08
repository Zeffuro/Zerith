import { validateScript } from 'core/schemas';
import { executeProjectOpenAction } from '../store/actions/projectOpenActions';

export function applyScriptFile(path: string, data: any[]) {
    const validScript = validateScript(data);
    executeProjectOpenAction({ action: 'applyScriptFile', path, script: validScript });
}

export function applyMacrosFile(path: string, obj: Record<string, any>) {
    const keys = Object.keys(obj).filter((k) => Array.isArray(obj[k]));
    const entries = keys
        .map((name) => ({ name, commands: validateScript(obj[name]) }))
        .sort((a, b) => a.name.localeCompare(b.name));

    executeProjectOpenAction({ action: 'applyMacrosFile', path, entries });
}

export function applyAssetSelection(assetPath: string) {
    executeProjectOpenAction({ action: 'applyAssetSelection', assetPath });
}

export function looksLikeMacrosObject(data: any): data is Record<string, any> {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    const keys = Object.keys(data);
    if (keys.length === 0) return false;
    return keys.every((k) => Array.isArray((data as any)[k]));
}