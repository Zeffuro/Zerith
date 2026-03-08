import { useMemo } from 'react';

import type { ScriptPath } from '../../../utils/scriptPathUtilities';

import { executeTimelineNodeClickSelectionAction } from '../../../store/actions/timelineSelectionActions';
import { useEditorStore } from '../../../store/useEditorStore';

export function useTimelineSelection() {
    const selectedNodePaths = useEditorStore(state => state.selectedNodePaths);

    const selectedKeys = useMemo(
        () => new Set(selectedNodePaths.map((p) => p.join('.'))),
        [selectedNodePaths]
    );

    return { onNodeClick: onTimelineNodeClick, selectedKeys, selectedNodePaths };
}

function onTimelineNodeClick(event: React.MouseEvent, nodePath: ScriptPath): void {
    executeTimelineNodeClickSelectionAction({
        mod: event.metaKey || event.ctrlKey,
        nodePath,
        shift: event.shiftKey,
    });
}

