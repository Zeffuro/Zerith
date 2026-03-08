import { useMemo } from 'react';
import type { ScriptPath } from '../../../utils/scriptPathUtils';
import { useEditorStore } from '../../../store/useEditorStore';
import { executeTimelineNodeClickSelectionAction } from '../../../store/actions/timelineSelectionActions';

export function useTimelineSelection() {
    const selectedNodePaths = useEditorStore(state => state.selectedNodePaths);

    const selectedKeys = useMemo(
        () => new Set(selectedNodePaths.map((p) => p.join('.'))),
        [selectedNodePaths]
    );

    const onNodeClick = (e: React.MouseEvent, nodePath: ScriptPath) => {
        executeTimelineNodeClickSelectionAction({
            nodePath,
            mod: e.metaKey || e.ctrlKey,
            shift: e.shiftKey,
        });
    };

    return { selectedNodePaths, selectedKeys, onNodeClick };
}