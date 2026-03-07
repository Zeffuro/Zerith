import { useMemo } from 'react';
import type { ScriptPath } from '../../../utils/scriptPathUtils';
import { useEditorStore } from '../../../store/useEditorStore';
import { useScriptStore } from '../../../store/useScriptStore';

const pathEq = (a: ScriptPath, b: ScriptPath) => a.length === b.length && a.every((v, i) => v === b[i]);

export function useTimelineSelection() {
    const selectedNodePaths = useEditorStore(state => state.selectedNodePaths);
    const selectionAnchorPath = useEditorStore(state => state.selectionAnchorPath);
    const setSelectedNodePaths = useEditorStore(state => state.setSelectedNodePaths);
    const setSelectionAnchorPath = useEditorStore(state => state.setSelectionAnchorPath);

    const setSelectedNodePath = useScriptStore(state => state.setSelectedNodePath);
    const setSelectedNode = useScriptStore(state => state.setSelectedNode);

    const selectedKeys = useMemo(
        () => new Set(selectedNodePaths.map((p) => p.join('.'))),
        [selectedNodePaths]
    );

    const onNodeClick = (e: React.MouseEvent, nodePath: ScriptPath) => {
        const mod = e.metaKey || e.ctrlKey;
        const shift = e.shiftKey;
        const isRoot = nodePath.length === 1 && typeof nodePath[0] === 'number';

        if (!isRoot) {
            setSelectedNodePath(nodePath);
            setSelectedNodePaths([nodePath]);
            setSelectionAnchorPath(nodePath);
            return;
        }

        const current = [nodePath[0] as number] as ScriptPath;

        if (shift && selectionAnchorPath && selectionAnchorPath.length === 1 && typeof selectionAnchorPath[0] === 'number') {
            const a = selectionAnchorPath[0] as number;
            const b = nodePath[0] as number;
            const [start, end] = a <= b ? [a, b] : [b, a];
            const range: ScriptPath[] = [];
            for (let i = start; i <= end; i++) range.push([i]);
            setSelectedNodePaths(range);
            setSelectedNodePath(current);
            setSelectedNode(current[0] as number);
            return;
        }

        if (mod) {
            const exists = selectedNodePaths.some((p) => pathEq(p as ScriptPath, current));
            const next = exists
                ? selectedNodePaths.filter((p) => !pathEq(p as ScriptPath, current))
                : [...selectedNodePaths, current];

            setSelectedNodePaths(next as ScriptPath[]);
            setSelectedNodePath(current);
            setSelectedNode(current[0] as number);
            if (!selectionAnchorPath) setSelectionAnchorPath(current);
            return;
        }

        setSelectedNodePaths([current]);
        setSelectionAnchorPath(current);
        setSelectedNodePath(current);
        setSelectedNode(current[0] as number);
    };

    return { selectedNodePaths, selectedKeys, onNodeClick };
}