import type { ScriptPath } from '../../utils/scriptPathUtils';
import { useEditorStore } from '../useEditorStore';
import { useScriptStore } from '../useScriptStore';

const pathEq = (a: ScriptPath, b: ScriptPath) => a.length === b.length && a.every((v, i) => v === b[i]);

export function executeSyncRootSelectionAfterMultiMoveAction(fallbackCount: number): void {
    const scriptState = useScriptStore.getState();
    const editorState = useEditorStore.getState();

    const selected = editorState.selectedNodePaths;
    const count = selected.length > 1 ? selected.length : fallbackCount;

    const endIdx = scriptState.selectedNodePath?.[0];
    if (typeof endIdx !== 'number') return;

    const startIdx = Math.max(0, endIdx - count + 1);
    const nextPaths: ScriptPath[] = Array.from({ length: count }, (_, i) => [startIdx + i]);

    editorState.setSelectedNodePaths(nextPaths);
    editorState.setSelectionAnchorPath(nextPaths[0] ?? null);
}

export interface ExecuteTimelineNodeClickSelectionActionOptions {
    nodePath: ScriptPath;
    mod: boolean;
    shift: boolean;
}

export function executeTimelineNodeClickSelectionAction(
    options: ExecuteTimelineNodeClickSelectionActionOptions,
): void {
    const { nodePath, mod, shift } = options;

    const editor = useEditorStore.getState();
    const script = useScriptStore.getState();

    const isRoot = nodePath.length === 1 && typeof nodePath[0] === 'number';
    if (!isRoot) {
        script.setSelectedNodePath(nodePath);
        editor.setSelectedNodePaths([nodePath]);
        editor.setSelectionAnchorPath(nodePath);
        return;
    }

    const current = [nodePath[0] as number] as ScriptPath;

    if (
        shift &&
        editor.selectionAnchorPath &&
        editor.selectionAnchorPath.length === 1 &&
        typeof editor.selectionAnchorPath[0] === 'number'
    ) {
        const a = editor.selectionAnchorPath[0] as number;
        const b = nodePath[0] as number;
        const [start, end] = a <= b ? [a, b] : [b, a];
        const range: ScriptPath[] = [];
        for (let i = start; i <= end; i++) range.push([i]);

        editor.setSelectedNodePaths(range);
        script.setSelectedNodePath(current);
        script.setSelectedNode(current[0] as number);
        return;
    }

    if (mod) {
        const exists = editor.selectedNodePaths.some((p) => pathEq(p as ScriptPath, current));
        const next = exists
            ? editor.selectedNodePaths.filter((p) => !pathEq(p as ScriptPath, current))
            : [...editor.selectedNodePaths, current];

        editor.setSelectedNodePaths(next as ScriptPath[]);
        script.setSelectedNodePath(current);
        script.setSelectedNode(current[0] as number);
        if (!editor.selectionAnchorPath) editor.setSelectionAnchorPath(current);
        return;
    }

    editor.setSelectedNodePaths([current]);
    editor.setSelectionAnchorPath(current);
    script.setSelectedNodePath(current);
    script.setSelectedNode(current[0] as number);
}

