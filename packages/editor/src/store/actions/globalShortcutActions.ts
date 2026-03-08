import type { Command } from 'core';
import type { ScriptPath } from '../../utils/scriptPathUtils';
import { useEditorStore } from '../useEditorStore';
import { useProjectStore } from '../useProjectStore';
import { useScriptStore } from '../useScriptStore';

export type GlobalShortcutAction =
    | 'save'
    | 'undo'
    | 'redo'
    | 'duplicate'
    | 'requestDelete'
    | 'moveSelectionUp'
    | 'moveSelectionDown'
    | 'copySelection'
    | 'pasteSelection';

type MacroClipboardPayload = {
    name?: string;
    commands?: Command[];
};

type MacroClipboardNode = {
    __kind: 'macro_header';
    payload: MacroClipboardPayload;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object';
}

function isMacroClipboardNode(value: unknown): value is MacroClipboardNode {
    if (!isRecord(value)) return false;
    if (value.__kind !== 'macro_header') return false;
    return isRecord(value.payload);
}

function cloneValue<T>(value: T): T {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
}

export async function executeGlobalShortcutAction(action: GlobalShortcutAction): Promise<boolean> {
    switch (action) {
        case 'save':
            await useProjectStore.getState().saveActiveFileFromCurrentScript();
            return true;

        case 'undo':
            useScriptStore.getState().undo();
            return true;

        case 'redo':
            useScriptStore.getState().redo();
            return true;

        case 'duplicate':
            duplicateSelection();
            return true;

        case 'requestDelete':
            return requestDeleteSelection();

        case 'moveSelectionUp':
            return moveSelectionByArrow('up');

        case 'moveSelectionDown':
            return moveSelectionByArrow('down');

        case 'copySelection':
            copySelectionToClipboard();
            return true;

        case 'pasteSelection':
            return pasteClipboardSelection();
    }
}

function duplicateSelection(): void {
    const editingAllMacrosFile = useProjectStore.getState().editingAllMacrosFile;
    const editor = useEditorStore.getState();

    if (editingAllMacrosFile) {
        const rootIndices = editor.selectedNodePaths
            .filter((p) => Array.isArray(p) && p.length === 1 && typeof p[0] === 'number')
            .map((p) => p[0] as number)
            .filter((v, i, a) => a.indexOf(v) === i)
            .sort((a, b) => a - b);

        if (rootIndices.length > 0) {
            useProjectStore.getState().duplicateMacroEntries(rootIndices);
            const duplicated = rootIndices.map((idx, i) => idx + 1 + i);
            const dupPaths = duplicated.map((i) => [i] as ScriptPath);
            editor.setSelectedNodePaths(dupPaths);
            editor.setSelectionAnchorPath(dupPaths[0] ?? null);
        }
        return;
    }

    const script = useScriptStore.getState();

    if (editor.selectedNodePaths.length > 1) {
        const originals = editor.selectedNodePaths
            .filter((p) => Array.isArray(p) && p.length === 1 && typeof p[0] === 'number')
            .map((p) => p[0] as number)
            .filter((v, i, a) => a.indexOf(v) === i)
            .sort((a, b) => a - b);

        script.duplicateNodesByPaths(editor.selectedNodePaths as ScriptPath[]);

        const duplicated: number[] = [];
        for (let i = 0; i < originals.length; i++) duplicated.push(originals[i] + 1 + i);

        const dupPaths = duplicated.map((i) => [i] as ScriptPath);
        editor.setSelectedNodePaths(dupPaths);
        editor.setSelectionAnchorPath(dupPaths[0] ?? null);
        return;
    }

    if (script.selectedNodePath) {
        script.duplicateNodeByPath(script.selectedNodePath);
        const idx =
            script.selectedNodePath.length === 1 && typeof script.selectedNodePath[0] === 'number'
                ? (script.selectedNodePath[0] as number) + 1
                : null;
        if (idx !== null) {
            editor.setSelectedNodePaths([[idx]]);
            editor.setSelectionAnchorPath([idx]);
        }
    }
}

function requestDeleteSelection(): boolean {
    const script = useScriptStore.getState();
    const editor = useEditorStore.getState();

    const paths =
        editor.selectedNodePaths.length > 1
            ? editor.selectedNodePaths
            : script.selectedNodePath
                ? [script.selectedNodePath]
                : [];

    if (paths.length > 0) {
        editor.requestDelete(paths, 'keyboard');
        return true;
    }

    return false;
}

function moveSelectionByArrow(direction: 'up' | 'down'): boolean {
    const editingAllMacrosFile = useProjectStore.getState().editingAllMacrosFile;

    if (editingAllMacrosFile) {
        const editor = useEditorStore.getState();
        const selected = editor.selectedNodePaths;
        if (selected.length !== 1) return false;

        const p = selected[0];
        if (!p || p.length !== 1 || typeof p[0] !== 'number') return false;

        const idx = p[0] as number;
        const project = useProjectStore.getState();
        const total = project.macroEntries.length;

        if (direction === 'up') {
            if (idx <= 0) return false;
            project.moveMacroEntries([idx], idx - 1);
            editor.setSelectedNodePaths([[idx - 1]]);
            editor.setSelectionAnchorPath([idx - 1]);
            return true;
        } else {
            if (idx >= total - 1) return false;
            project.moveMacroEntries([idx], idx + 2);
            editor.setSelectedNodePaths([[idx + 1]]);
            editor.setSelectionAnchorPath([idx + 1]);
            return true;
        }
    }

    const script = useScriptStore.getState();
    const selectedNodePath = script.selectedNodePath;
    if (!selectedNodePath) return false;

    const parent = selectedNodePath.slice(0, -1);
    const idx = selectedNodePath[selectedNodePath.length - 1];
    if (typeof idx !== 'number') return false;

    const parentArray = script.getNodeAtPath(parent) as unknown[] | undefined;
    if (!Array.isArray(parentArray)) return false;

    if (direction === 'up') {
        if (idx <= 0) return false;
        script.moveNodeByPath(selectedNodePath, parent, idx - 1);
        return true;
    } else {
        if (idx >= parentArray.length - 1) return false;
        script.moveNodeByPath(selectedNodePath, parent, idx + 2);
        return true;
    }
}

function copySelectionToClipboard(): void {
    const editingAllMacrosFile = useProjectStore.getState().editingAllMacrosFile;
    const editor = useEditorStore.getState();

    if (editingAllMacrosFile) {
        const root = editor.selectedNodePaths.find((p) => p.length === 1 && typeof p[0] === 'number');
        if (root) {
            const idx = root[0] as number;
            const macro = useProjectStore.getState().macroEntries[idx];
            if (macro) {
                editor.setClipboardNode({
                    __kind: 'macro_header',
                    payload: cloneValue(macro),
                });
            }
            return;
        }
    }

    const script = useScriptStore.getState();
    if (script.selectedNodePath) {
        const node = script.getNodeAtPath(script.selectedNodePath);
        if (node !== undefined) {
            editor.setClipboardNode(cloneValue(node));
        }
    }
}

function pasteClipboardSelection(): boolean {
    const project = useProjectStore.getState();
    const editor = useEditorStore.getState();
    const clipboardNode = editor.clipboardNode;

    if (project.editingAllMacrosFile && isMacroClipboardNode(clipboardNode)) {
        const selected = editor.selectedNodePaths;
        const root = selected.find((p) => p.length === 1 && typeof p[0] === 'number');
        const insertAt = root ? ((root[0] as number) + 1) : project.macroEntries.length;

        const copied = clipboardNode.payload;
        const entries = [...project.macroEntries];

        const taken = new Set(entries.map((m) => m.name));
        let nextName = copied.name || 'macro_copy';
        if (taken.has(nextName)) {
            let i = 2;
            const base = `${nextName}_copy`;
            nextName = base;
            while (taken.has(nextName)) nextName = `${base}_${i++}`;
        }

        const inserted = {
            name: nextName,
            commands: cloneValue(Array.isArray(copied.commands) ? copied.commands : [] as Command[]),
        };

        entries.splice(Math.max(0, Math.min(insertAt, entries.length)), 0, inserted);
        project.setMacroEntries(entries);

        const newIdx = Math.max(0, Math.min(insertAt, entries.length - 1));
        editor.setSelectedNodePaths([[newIdx]]);
        editor.setSelectionAnchorPath([newIdx]);
        return true;
    }

    const script = useScriptStore.getState();
    if (script.selectedNodePath && clipboardNode && !isMacroClipboardNode(clipboardNode)) {
        script.pasteNodeAtPath(script.selectedNodePath, clipboardNode);
        return true;
    }

    return false;
}

