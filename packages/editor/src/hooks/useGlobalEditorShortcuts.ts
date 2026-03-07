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
                const { selectedNodePath, duplicateNodeByPath, duplicateNodesByPaths } = useScriptStore.getState();
                const { selectedNodePaths, setSelectedNodePaths, setSelectionAnchorPath } = useEditorStore.getState();

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

            if (mod && key === 'c') {
                e.preventDefault();
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

            if (mod && key === 'v') {
                const { selectedNodePath, pasteNodeAtPath } = useScriptStore.getState();
                const { clipboardNode } = useEditorStore.getState();
                if (selectedNodePath && clipboardNode) {
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