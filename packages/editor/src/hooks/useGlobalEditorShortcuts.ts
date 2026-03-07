import { useEffect } from 'react';
import { useEditorStore } from '../store/useEditorStore';
import { useProjectStore } from '../store/useProjectStore';
import { useScriptStore } from '../store/useScriptStore';

function isTypingTarget(el: EventTarget | null) {
    const node = el as HTMLElement | null;
    if (!node) return false;
    const tag = node.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || node.isContentEditable;
}

export function useGlobalEditorShortcuts() {
    useEffect(() => {
        const onKeyDown = async (e: KeyboardEvent) => {
            const mod = e.ctrlKey || e.metaKey;
            const key = e.key.toLowerCase();

            if (mod && key === 's') {
                e.preventDefault();
                await useProjectStore.getState().saveActiveFileFromCurrentScript();
                return;
            }

            if (isTypingTarget(e.target)) return;

            if (mod && key === 'z' && !e.shiftKey) {
                e.preventDefault();
                useScriptStore.getState().undo();
                return;
            }

            if ((mod && key === 'y') || (mod && e.shiftKey && key === 'z')) {
                e.preventDefault();
                useScriptStore.getState().redo();
                return;
            }

            if (mod && key === 'd') {
                e.preventDefault();

                const editingAllMacrosFile = useProjectStore.getState().editingAllMacrosFile;
                const selectedNodePaths = useEditorStore.getState().selectedNodePaths;
                const setSelectedNodePaths = useEditorStore.getState().setSelectedNodePaths;
                const setSelectionAnchorPath = useEditorStore.getState().setSelectionAnchorPath;

                if (editingAllMacrosFile) {
                    const rootIndices = selectedNodePaths
                        .filter((p) => Array.isArray(p) && p.length === 1 && typeof p[0] === 'number')
                        .map((p) => p[0] as number)
                        .filter((v, i, a) => a.indexOf(v) === i)
                        .sort((a, b) => a - b);

                    if (rootIndices.length > 0) {
                        useProjectStore.getState().duplicateMacroEntries(rootIndices);
                        const duplicated = rootIndices.map((idx, i) => idx + 1 + i);
                        const dupPaths = duplicated.map((i) => [i]);
                        setSelectedNodePaths(dupPaths as any);
                        setSelectionAnchorPath(dupPaths[0] ?? null);
                    }
                    return;
                }

                const { selectedNodePath, duplicateNodeByPath, duplicateNodesByPaths } = useScriptStore.getState();

                if (selectedNodePaths.length > 1) {
                    const originals = (selectedNodePaths as any[])
                        .filter((p) => Array.isArray(p) && p.length === 1 && typeof p[0] === 'number')
                        .map((p) => p[0] as number)
                        .filter((v, i, a) => a.indexOf(v) === i)
                        .sort((a, b) => a - b);

                    duplicateNodesByPaths(selectedNodePaths as any);

                    const duplicated: number[] = [];
                    for (let i = 0; i < originals.length; i++) duplicated.push(originals[i] + 1 + i);

                    const dupPaths = duplicated.map((i) => [i]);
                    setSelectedNodePaths(dupPaths as any);
                    setSelectionAnchorPath(dupPaths[0] ?? null);
                    return;
                }

                if (selectedNodePath) {
                    duplicateNodeByPath(selectedNodePath);
                    const idx =
                        selectedNodePath.length === 1 && typeof selectedNodePath[0] === 'number'
                            ? (selectedNodePath[0] as number) + 1
                            : null;
                    if (idx !== null) {
                        setSelectedNodePaths([[idx]]);
                        setSelectionAnchorPath([idx]);
                    }
                }
                return;
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                const { selectedNodePath } = useScriptStore.getState();
                const { selectedNodePaths, requestDelete } = useEditorStore.getState();

                const paths =
                    selectedNodePaths.length > 1
                        ? selectedNodePaths
                        : selectedNodePath
                            ? [selectedNodePath]
                            : [];

                if (paths.length > 0) {
                    e.preventDefault();
                    requestDelete(paths, 'keyboard');
                }
                return;
            }

            if (mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                const editingAllMacrosFile = useProjectStore.getState().editingAllMacrosFile;

                if (editingAllMacrosFile) {
                    const selected = useEditorStore.getState().selectedNodePaths;
                    if (selected.length !== 1) return;
                    const p = selected[0];
                    if (!p || p.length !== 1 || typeof p[0] !== 'number') return;

                    const idx = p[0] as number;
                    const total = useProjectStore.getState().macroEntries.length;
                    const moveMacroEntries = useProjectStore.getState().moveMacroEntries;
                    const setSelectedNodePaths = useEditorStore.getState().setSelectedNodePaths;
                    const setSelectionAnchorPath = useEditorStore.getState().setSelectionAnchorPath;

                    if (e.key === 'ArrowUp') {
                        if (idx <= 0) return;
                        e.preventDefault();
                        moveMacroEntries([idx], idx - 1);
                        setSelectedNodePaths([[idx - 1]]);
                        setSelectionAnchorPath([idx - 1]);
                    } else {
                        if (idx >= total - 1) return;
                        e.preventDefault();
                        moveMacroEntries([idx], idx + 2);
                        setSelectedNodePaths([[idx + 1]]);
                        setSelectionAnchorPath([idx + 1]);
                    }
                    return;
                }

                const { selectedNodePath, moveNodeByPath, getNodeAtPath } = useScriptStore.getState();
                if (selectedNodePath) {
                    e.preventDefault();

                    const parent = selectedNodePath.slice(0, -1);
                    const idx = selectedNodePath[selectedNodePath.length - 1];
                    if (typeof idx !== 'number') return;

                    const parentArray = getNodeAtPath(parent) as any[] | undefined;
                    if (!Array.isArray(parentArray)) return;

                    if (e.key === 'ArrowUp') {
                        if (idx <= 0) return;
                        moveNodeByPath(selectedNodePath, parent, idx - 1);
                    } else {
                        if (idx >= parentArray.length - 1) return;
                        moveNodeByPath(selectedNodePath, parent, idx + 2);
                    }
                }
                return;
            }

            // COPY
            if (mod && key === 'c') {
                e.preventDefault();

                const editingAllMacrosFile = useProjectStore.getState().editingAllMacrosFile;
                const selected = useEditorStore.getState().selectedNodePaths;

                if (editingAllMacrosFile) {
                    const root = selected.find((p) => p.length === 1 && typeof p[0] === 'number');
                    if (root) {
                        const idx = root[0] as number;
                        const macro = useProjectStore.getState().macroEntries[idx];
                        if (macro) {
                            useEditorStore.getState().setClipboardNode({
                                __kind: 'macro_header',
                                payload: typeof structuredClone === 'function'
                                    ? structuredClone(macro)
                                    : JSON.parse(JSON.stringify(macro)),
                            });
                        }
                        return;
                    }
                }

                const { selectedNodePath, getNodeAtPath } = useScriptStore.getState();
                if (selectedNodePath) {
                    const node = getNodeAtPath(selectedNodePath);
                    if (node !== undefined) {
                        useEditorStore.getState().setClipboardNode(
                            typeof structuredClone === 'function'
                                ? structuredClone(node)
                                : JSON.parse(JSON.stringify(node))
                        );
                    }
                }
                return;
            }

            // PASTE
            if (mod && key === 'v') {
                const editingAllMacrosFile = useProjectStore.getState().editingAllMacrosFile;
                const { clipboardNode } = useEditorStore.getState();

                if (editingAllMacrosFile && clipboardNode && (clipboardNode as any).__kind === 'macro_header') {
                    e.preventDefault();

                    const selected = useEditorStore.getState().selectedNodePaths;
                    const root = selected.find((p) => p.length === 1 && typeof p[0] === 'number');
                    const insertAt = root ? ((root[0] as number) + 1) : useProjectStore.getState().macroEntries.length;

                    const copied = (clipboardNode as any).payload;
                    const entries = [...useProjectStore.getState().macroEntries];

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
                        commands: typeof structuredClone === 'function'
                            ? structuredClone(copied.commands ?? [])
                            : JSON.parse(JSON.stringify(copied.commands ?? [])),
                    };

                    entries.splice(Math.max(0, Math.min(insertAt, entries.length)), 0, inserted);
                    useProjectStore.getState().setMacroEntries(entries);

                    const newIdx = Math.max(0, Math.min(insertAt, entries.length - 1));
                    useEditorStore.getState().setSelectedNodePaths([[newIdx]]);
                    useEditorStore.getState().setSelectionAnchorPath([newIdx]);
                    return;
                }

                const { selectedNodePath, pasteNodeAtPath } = useScriptStore.getState();
                if (selectedNodePath && clipboardNode && !(clipboardNode as any).__kind) {
                    e.preventDefault();
                    pasteNodeAtPath(selectedNodePath, clipboardNode);
                }
                return;
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);
}