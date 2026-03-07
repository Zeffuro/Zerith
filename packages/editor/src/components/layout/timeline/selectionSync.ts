import type { ScriptPath } from '../../../utils/scriptPathUtils';
import { useEditorStore } from '../../../store/useEditorStore';
import { useScriptStore } from '../../../store/useScriptStore';

export function syncRootSelectionAfterMultiMove(fallbackCount: number) {
    const scriptState = useScriptStore.getState();
    const selected = useEditorStore.getState().selectedNodePaths;
    const count = selected.length > 1 ? selected.length : fallbackCount;

    const endIdx = scriptState.selectedNodePath?.[0];
    if (typeof endIdx !== 'number') return;

    const startIdx = Math.max(0, endIdx - count + 1);
    const nextPaths: ScriptPath[] = Array.from({ length: count }, (_, i) => [startIdx + i]);

    useEditorStore.getState().setSelectedNodePaths(nextPaths);
    useEditorStore.getState().setSelectionAnchorPath(nextPaths[0] ?? null);
}