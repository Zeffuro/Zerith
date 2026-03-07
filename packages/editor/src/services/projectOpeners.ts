import { validateScript } from 'core';
import { useProjectStore } from '../store/useProjectStore';
import { useEditorStore } from '../store/useEditorStore';

export function applyScriptFile(path: string, data: any[]) {
    const validScript = validateScript(data);
    const p = useProjectStore.getState();
    p.setActiveFile(path, validScript);
    p.setActiveMacroName(null);
    p.setEditingAllMacrosFile(false);
    p.setMacroEntries([]);
}

export function applyMacrosFile(path: string, obj: Record<string, any>) {
    const keys = Object.keys(obj).filter((k) => Array.isArray(obj[k]));
    const entries = keys
        .map((name) => ({ name, commands: validateScript(obj[name]) }))
        .sort((a, b) => a.name.localeCompare(b.name));

    const p = useProjectStore.getState();
    p.setActiveMacroName(null);
    p.setEditingAllMacrosFile(true);
    p.setMacroEntries(entries);
    p.setActiveFile(path, []);
}

export function applyAssetSelection(assetPath: string) {
    useEditorStore.getState().setSelectedAssetPath(assetPath);
}

export function looksLikeMacrosObject(data: any): data is Record<string, any> {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    const keys = Object.keys(data);
    if (keys.length === 0) return false;
    return keys.every((k) => Array.isArray((data as any)[k]));
}