import type { ScriptPath } from '../../utils/scriptPathUtilities';

import { useScriptStore } from '../storeBootstrap';
import { useEditorStore } from '../useEditorStore';

const pathEq = (a: ScriptPath, b: ScriptPath) => a.length === b.length && a.every((v, index) => v === b[index]);

export interface ExecuteTimelineNodeClickSelectionActionOptions {
    mod: boolean;
    nodePath: ScriptPath;
    shift: boolean;
}

export function executeSyncRootSelectionAfterMultiMoveAction(fallbackCount: number): void {
    const scriptState = useScriptStore.getState();
    const editorState = useEditorStore.getState();

    const selected = editorState.selectedNodePaths;
    const count = selected.length > 1 ? selected.length : fallbackCount;

    const endIndex = scriptState.selectedNodePath?.[0];
    if (typeof endIndex !== 'number') return;

    const startIndex = Math.max(0, endIndex - count + 1);
    const nextPaths: ScriptPath[] = Array.from({ length: count }, (_, index) => [startIndex + index]);

    editorState.setSelectedNodePaths(nextPaths);
    editorState.setSelectionAnchorPath(nextPaths[0] ?? undefined);
}

export function executeTimelineNodeClickSelectionAction(
    options: ExecuteTimelineNodeClickSelectionActionOptions,
): void {
    const { mod, nodePath, shift } = options;

    const editor = useEditorStore.getState();
    const script = useScriptStore.getState();

    const isRoot = nodePath.length === 1 && typeof nodePath[0] === 'number';
    if (!isRoot) {
        script.setSelectedNodePath(nodePath);
        editor.setSelectedNodePaths([nodePath]);
        editor.setSelectionAnchorPath(nodePath);
        return;
    }

    const current = [nodePath[0]] as ScriptPath;

    if (
        shift &&
        editor.selectionAnchorPath &&
        editor.selectionAnchorPath.length === 1 &&
        typeof editor.selectionAnchorPath[0] === 'number'
    ) {
        const a = editor.selectionAnchorPath[0];
        const b = nodePath[0] as number;
        const [start, end] = a <= b ? [a, b] : [b, a];
        const range: ScriptPath[] = [];
        for (let index = start; index <= end; index++) range.push([index]);

        editor.setSelectedNodePaths(range);
        script.setSelectedNodePath(current);
        script.setSelectedNode(current[0] as number);
        return;
    }

    if (mod) {
        const exists = editor.selectedNodePaths.some((p) => pathEq(p, current));
        const next = exists
            ? editor.selectedNodePaths.filter((p) => !pathEq(p, current))
            : [...editor.selectedNodePaths, current];

        editor.setSelectedNodePaths(next);
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


