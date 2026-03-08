import type { Command } from 'core';

import type { ScriptPath } from '../../utils/scriptPathUtils';

import { useEditorStore } from '../useEditorStore';
import { useProjectStore } from '../useProjectStore';
import { useScriptStore } from '../useScriptStore';

export type GlobalShortcutAction =
    | 'copySelection'
    | 'duplicate'
    | 'moveSelectionDown'
    | 'moveSelectionUp'
    | 'pasteSelection'
    | 'redo'
    | 'requestDelete'
    | 'save'
    | 'undo';

type MacroClipboardNode = {
    __kind: 'macro_header';
    payload: MacroClipboardPayload;
};

type MacroClipboardPayload = {
    commands?: Command[];
    name?: string;
};

export async function executeGlobalShortcutAction(action: GlobalShortcutAction): Promise<boolean> {
    switch (action) {
        case 'copySelection': {
            copySelectionToClipboard();
            return true;
        }

        case 'duplicate': {
            duplicateSelection();
            return true;
        }

        case 'moveSelectionDown': {
            return moveSelectionByArrow('down');
        }

        case 'moveSelectionUp': {
            return moveSelectionByArrow('up');
        }

        case 'pasteSelection': {
            return pasteClipboardSelection();
        }

        case 'redo': {
            useScriptStore.getState().redo();
            return true;
        }

        case 'requestDelete': {
            return requestDeleteSelection();
        }

        case 'save': {
            await useProjectStore.getState().saveActiveFileFromCurrentScript();
            return true;
        }

        case 'undo': {
            useScriptStore.getState().undo();
            return true;
        }
    }
}

function cloneValue<T>(value: T): T {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
}

function copySelectionToClipboard(): void {
    const editingAllMacrosFile = useProjectStore.getState().editingAllMacrosFile;
    const editor = useEditorStore.getState();

    if (editingAllMacrosFile) {
        const root = editor.selectedNodePaths.find((p) => p.length === 1 && typeof p[0] === 'number');
        if (root) {
            const index = root[0] as number;
            const macro = useProjectStore.getState().macroEntries[index];
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

function duplicateSelection(): void {
    const editingAllMacrosFile = useProjectStore.getState().editingAllMacrosFile;
    const editor = useEditorStore.getState();

    if (editingAllMacrosFile) {
        const rootIndices = editor.selectedNodePaths
            .filter((p) => Array.isArray(p) && p.length === 1 && typeof p[0] === 'number')
            .map((p) => p[0] as number)
            .filter((v, index, a) => a.indexOf(v) === index)
            .sort((a, b) => a - b);

        if (rootIndices.length > 0) {
            useProjectStore.getState().duplicateMacroEntries(rootIndices);
            const duplicated = rootIndices.map((index, index_) => index + 1 + index_);
            const dupPaths = duplicated.map((index) => [index] as ScriptPath);
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
            .filter((v, index, a) => a.indexOf(v) === index)
            .sort((a, b) => a - b);

        script.duplicateNodesByPaths(editor.selectedNodePaths);

        const duplicated: number[] = [];
        for (let index = 0; index < originals.length; index++) duplicated.push(originals[index] + 1 + index);

        const dupPaths = duplicated.map((index) => [index] as ScriptPath);
        editor.setSelectedNodePaths(dupPaths);
        editor.setSelectionAnchorPath(dupPaths[0] ?? null);
        return;
    }

    if (script.selectedNodePath) {
        script.duplicateNodeByPath(script.selectedNodePath);
        const index =
            script.selectedNodePath.length === 1 && typeof script.selectedNodePath[0] === 'number'
                ? (script.selectedNodePath[0]) + 1
                : null;
        if (index !== null) {
            editor.setSelectedNodePaths([[index]]);
            editor.setSelectionAnchorPath([index]);
        }
    }
}

function isMacroClipboardNode(value: unknown): value is MacroClipboardNode {
    if (!isRecord(value)) return false;
    if (value.__kind !== 'macro_header') return false;
    return isRecord(value.payload);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object';
}

function moveSelectionByArrow(direction: 'down' | 'up'): boolean {
    const editingAllMacrosFile = useProjectStore.getState().editingAllMacrosFile;

    if (editingAllMacrosFile) {
        const editor = useEditorStore.getState();
        const selected = editor.selectedNodePaths;
        if (selected.length !== 1) return false;

        const p = selected[0];
        if (!p || p.length !== 1 || typeof p[0] !== 'number') return false;

        const index = p[0];
        const project = useProjectStore.getState();
        const total = project.macroEntries.length;

        if (direction === 'up') {
            if (index <= 0) return false;
            project.moveMacroEntries([index], index - 1);
            editor.setSelectedNodePaths([[index - 1]]);
            editor.setSelectionAnchorPath([index - 1]);
            return true;
        } else {
            if (index >= total - 1) return false;
            project.moveMacroEntries([index], index + 2);
            editor.setSelectedNodePaths([[index + 1]]);
            editor.setSelectionAnchorPath([index + 1]);
            return true;
        }
    }

    const script = useScriptStore.getState();
    const selectedNodePath = script.selectedNodePath;
    if (!selectedNodePath) return false;

    const parent = selectedNodePath.slice(0, -1);
    const index = selectedNodePath.at(-1);
    if (typeof index !== 'number') return false;

    const parentArray = script.getNodeAtPath(parent) as undefined | unknown[];
    if (!Array.isArray(parentArray)) return false;

    if (direction === 'up') {
        if (index <= 0) return false;
        script.moveNodeByPath(selectedNodePath, parent, index - 1);
        return true;
    } else {
        if (index >= parentArray.length - 1) return false;
        script.moveNodeByPath(selectedNodePath, parent, index + 2);
        return true;
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
            let index = 2;
            const base = `${nextName}_copy`;
            nextName = base;
            while (taken.has(nextName)) nextName = `${base}_${index++}`;
        }

        const inserted = {
            commands: cloneValue(Array.isArray(copied.commands) ? copied.commands : [] as Command[]),
            name: nextName,
        };

        entries.splice(Math.max(0, Math.min(insertAt, entries.length)), 0, inserted);
        project.setMacroEntries(entries);

        const newIndex = Math.max(0, Math.min(insertAt, entries.length - 1));
        editor.setSelectedNodePaths([[newIndex]]);
        editor.setSelectionAnchorPath([newIndex]);
        return true;
    }

    const script = useScriptStore.getState();
    if (script.selectedNodePath && clipboardNode && !isMacroClipboardNode(clipboardNode)) {
        script.pasteNodeAtPath(script.selectedNodePath, clipboardNode);
        return true;
    }

    return false;
}

function requestDeleteSelection(): boolean {
    const script = useScriptStore.getState();
    const editor = useEditorStore.getState();

    const paths =
        editor.selectedNodePaths.length > 1
            ? editor.selectedNodePaths
            : (script.selectedNodePath
                ? [script.selectedNodePath]
                : []);

    if (paths.length > 0) {
        editor.requestDelete(paths, 'keyboard');
        return true;
    }

    return false;
}

