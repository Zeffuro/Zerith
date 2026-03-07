import { useRef, useState } from 'react';
import type { ScriptPath } from '../../../utils/scriptPathUtils';
import { useScriptStore } from '../../../store/useScriptStore';
import { useEditorStore } from '../../../store/useEditorStore';
import type { DropIndicator } from './types';

const sameArrayPath = (a: ScriptPath, b: ScriptPath) => a.length === b.length && a.every((v, i) => v === b[i]);
const isDescendantPath = (possibleDescendant: ScriptPath, ancestor: ScriptPath) =>
    possibleDescendant.length > ancestor.length && ancestor.every((v, i) => possibleDescendant[i] === v);

const isRootPath = (p: ScriptPath) => p.length === 1 && typeof p[0] === 'number';

export function useTimelineDragDrop() {
    const moveNodeByPath = useScriptStore((state) => state.moveNodeByPath);
    const moveNodesByPathsToArray = useScriptStore((state) => state.moveNodesByPathsToArray);

    const dragSourceRef = useRef<ScriptPath | null>(null);
    const dragSourcesRef = useRef<ScriptPath[] | null>(null); // multi sources
    const [dropIndicator, setDropIndicator] = useState<DropIndicator>(null);

    const handleNodeDragStart = (e: React.DragEvent, nodePath: ScriptPath) => {
        const selected = useEditorStore.getState().selectedNodePaths as ScriptPath[];
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

    const handleNodeDragOver = (e: React.DragEvent, arrayPath: ScriptPath, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        setDropIndicator({ arrayPath, index });
    };

    const handleNodeDrop = (e: React.DragEvent, arrayPath: ScriptPath, index: number) => {
        e.preventDefault();
        e.stopPropagation();

        const source = dragSourceRef.current;
        const sources = dragSourcesRef.current;

        dragSourceRef.current = null;
        dragSourcesRef.current = null;

        if (sources && sources.length > 1) {
            if (arrayPath.length === 0) {
                moveNodesByPathsToArray(sources, arrayPath, index);
            }
            setDropIndicator(null);
            return;
        }

        if (!source) return setDropIndicator(null);
        if (isDescendantPath(arrayPath, source)) return setDropIndicator(null);

        moveNodeByPath(source, arrayPath, index);
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