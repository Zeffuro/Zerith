import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import type { ScriptPath } from '../../../utils/scriptPathUtils';
import { useEditorStore } from '../../../store/useEditorStore';
import type { DropIndicator } from './types';
import { executeTimelineDropAction } from '../../../store/actions/timelineDragDropActions';

const sameArrayPath = (a: ScriptPath, b: ScriptPath) => a.length === b.length && a.every((v, i) => v === b[i]);
const isRootPath = (p: ScriptPath) => p.length === 1 && typeof p[0] === 'number';

export function useTimelineDragDrop() {
    const dragSourceRef = useRef<ScriptPath | null>(null);
    const dragSourcesRef = useRef<ScriptPath[] | null>(null);
    const [dropIndicator, setDropIndicator] = useState<DropIndicator>(null);

    const handleNodeDragStart = (e: DragEvent, nodePath: ScriptPath) => {
        const selected = useEditorStore.getState().selectedNodePaths;
        const selectedRoot = selected.filter(isRootPath);
        const draggedIsSelectedRoot = isRootPath(nodePath) && selectedRoot.some((p) => p[0] === nodePath[0]);

        if (draggedIsSelectedRoot && selectedRoot.length > 1) {
            dragSourcesRef.current = selectedRoot
                .map((p) => [p[0]] as ScriptPath)
                .sort((a, b) => (a[0] as number) - (b[0] as number));
            dragSourceRef.current = nodePath;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', `${selectedRoot.length} nodes`);
            return;
        }

        dragSourcesRef.current = null;
        dragSourceRef.current = nodePath;
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

        const source = dragSourceRef.current;
        const sources = dragSourcesRef.current;

        dragSourceRef.current = null;
        dragSourcesRef.current = null;

        executeTimelineDropAction({ source, sources, arrayPath, index });
        setDropIndicator(null);
    };

    const handleDragEnd = () => {
        dragSourceRef.current = null;
        dragSourcesRef.current = null;
        setDropIndicator(null);
    };

    return {
        dropIndicator,
        sameArrayPath,
        handleNodeDragStart,
        handleNodeDragOver,
        handleNodeDrop,
        handleDragEnd,
    };
}