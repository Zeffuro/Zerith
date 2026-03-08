import type { DragEvent } from 'react';

import { useRef, useState } from 'react';

import type { ScriptPath } from '../../../utils/scriptPathUtilities';
import type { DropIndicator } from './types';

import { executeTimelineDropAction } from '../../../store/actions/timelineDragDropActions';
import { useEditorStore } from '../../../store/useEditorStore';

const sameArrayPath = (a: ScriptPath, b: ScriptPath) => a.length === b.length && a.every((v, index) => v === b[index]);
const isRootPath = (p: ScriptPath) => p.length === 1 && typeof p[0] === 'number';

export function useTimelineDragDrop() {
    const dragSourceReference = useRef<ScriptPath | undefined>(undefined);
    const dragSourcesReference = useRef<ScriptPath[] | undefined>(undefined);
    const [dropIndicator, setDropIndicator] = useState<DropIndicator>();

    const handleNodeDragStart = (event: DragEvent, nodePath: ScriptPath) => {
        const selected = useEditorStore.getState().selectedNodePaths;
        const selectedRoot = selected.filter((path) => isRootPath(path));
        const draggedIsSelectedRoot = isRootPath(nodePath) && selectedRoot.some((p) => p[0] === nodePath[0]);

        if (draggedIsSelectedRoot && selectedRoot.length > 1) {
            dragSourcesReference.current = selectedRoot
                .map((p) => [p[0]] as ScriptPath)
                .toSorted((a, b) => (a[0] as number) - (b[0] as number));
            dragSourceReference.current = nodePath;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', `${selectedRoot.length} nodes`);
            return;
        }

        dragSourcesReference.current = undefined;
        dragSourceReference.current = nodePath;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', nodePath.join('.'));
    };

    const handleNodeDragOver = (event: DragEvent, arrayPath: ScriptPath, index: number) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        setDropIndicator({ arrayPath, index });
    };

    const handleNodeDrop = (event: DragEvent, arrayPath: ScriptPath, index: number) => {
        event.preventDefault();
        event.stopPropagation();

        const source = dragSourceReference.current;
        const sources = dragSourcesReference.current;

        dragSourceReference.current = undefined;
        dragSourcesReference.current = undefined;

        executeTimelineDropAction({ arrayPath, index, source, sources });
        setDropIndicator(undefined);
    };

    const handleDragEnd = () => {
        dragSourceReference.current = undefined;
        dragSourcesReference.current = undefined;
        setDropIndicator(undefined);
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
