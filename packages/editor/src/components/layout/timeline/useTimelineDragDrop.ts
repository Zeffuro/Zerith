import type { DragEvent } from 'react';

import { useRef, useState } from 'react';

import type { ScriptPath } from '../../../utils/scriptPathUtils';
import type { DropIndicator } from './types';

import { executeTimelineDropAction } from '../../../store/actions/timelineDragDropActions';
import { useEditorStore } from '../../../store/useEditorStore';

const sameArrayPath = (a: ScriptPath, b: ScriptPath) => a.length === b.length && a.every((v, index) => v === b[index]);
const isRootPath = (p: ScriptPath) => p.length === 1 && typeof p[0] === 'number';

export function useTimelineDragDrop() {
    const dragSourceReference = useRef<null | ScriptPath>(null);
    const dragSourcesReference = useRef<null | ScriptPath[]>(null);
    const [dropIndicator, setDropIndicator] = useState<DropIndicator>(null);

    const handleNodeDragStart = (e: DragEvent, nodePath: ScriptPath) => {
        const selected = useEditorStore.getState().selectedNodePaths;
        const selectedRoot = selected.filter(isRootPath);
        const draggedIsSelectedRoot = isRootPath(nodePath) && selectedRoot.some((p) => p[0] === nodePath[0]);

        if (draggedIsSelectedRoot && selectedRoot.length > 1) {
            dragSourcesReference.current = selectedRoot
                .map((p) => [p[0]] as ScriptPath)
                .sort((a, b) => (a[0] as number) - (b[0] as number));
            dragSourceReference.current = nodePath;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', `${selectedRoot.length} nodes`);
            return;
        }

        dragSourcesReference.current = null;
        dragSourceReference.current = nodePath;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', nodePath.join('.'));
    };

    const handleNodeDragOver = (e: DragEvent, arrayPath: ScriptPath, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        setDropIndicator({ arrayPath, index });
    };

    const handleNodeDrop = (e: DragEvent, arrayPath: ScriptPath, index: number) => {
        e.preventDefault();
        e.stopPropagation();

        const source = dragSourceReference.current;
        const sources = dragSourcesReference.current;

        dragSourceReference.current = null;
        dragSourcesReference.current = null;

        executeTimelineDropAction({ arrayPath, index, source, sources });
        setDropIndicator(null);
    };

    const handleDragEnd = () => {
        dragSourceReference.current = null;
        dragSourcesReference.current = null;
        setDropIndicator(null);
    };

    return {
        dropIndicator,
        handleDragEnd,
        handleNodeDragOver,
        handleNodeDragStart,
        handleNodeDrop,
        sameArrayPath,
    };
}