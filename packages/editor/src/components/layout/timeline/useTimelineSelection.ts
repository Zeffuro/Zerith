import { useMemo } from 'react';

import type { ScriptPath } from '../../../utils/scriptPathUtils';

import { executeTimelineNodeClickSelectionAction } from '../../../store/actions/timelineSelectionActions';
import { useEditorStore } from '../../../store/useEditorStore';

export function useTimelineSelection() {
    const selectedNodePaths = useEditorStore(state => state.selectedNodePaths);

    const selectedKeys = useMemo(
        () => new Set(selectedNodePaths.map((p) => p.join('.'))),
        [selectedNodePaths]
    );

    const onNodeClick = (e: React.MouseEvent, nodePath: ScriptPath) => {
        executeTimelineNodeClickSelectionAction({
            mod: e.metaKey || e.ctrlKey,
            nodePath,
            shift: e.shiftKey,
        });
    };

    return { onNodeClick, selectedKeys, selectedNodePaths };
}