import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import type { ScriptPath } from '../../../utils/scriptPathUtils';
import { moveNodeByPath as moveNodeByPathUtil } from '../../../utils/scriptPathUtils';
import { useScriptStore } from '../../../store/useScriptStore';
import { useEditorStore } from '../../../store/useEditorStore';
import { useProjectStore } from '../../../store/useProjectStore';
import type { DropIndicator } from './types';
import { syncRootSelectionAfterMultiMove } from './selectionSync';

const sameArrayPath = (a: ScriptPath, b: ScriptPath) => a.length === b.length && a.every((v, i) => v === b[i]);
const isDescendantPath = (possibleDescendant: ScriptPath, ancestor: ScriptPath) =>
    possibleDescendant.length > ancestor.length && ancestor.every((v, i) => possibleDescendant[i] === v);
const isRootPath = (p: ScriptPath) => p.length === 1 && typeof p[0] === 'number';

export function useTimelineDragDrop() {
    const moveNodeByPath = useScriptStore((state) => state.moveNodeByPath);
    const moveNodesByPathsToArray = useScriptStore((state) => state.moveNodesByPathsToArray);

    const editingAllMacrosFile = useProjectStore((s) => s.editingAllMacrosFile);
    const macroEntries = useProjectStore((s) => s.macroEntries);
    const setMacroEntries = useProjectStore((s) => s.setMacroEntries);
    const moveMacroEntries = useProjectStore((s) => s.moveMacroEntries);

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

    const moveInsideMacroCommands = (source: ScriptPath, targetArrayPath: ScriptPath, targetIndex: number) => {
        const sourceMacroIndex = source[0];
        const targetMacroIndex = targetArrayPath[0];

        if (typeof sourceMacroIndex !== 'number' || typeof targetMacroIndex !== 'number') return;
        if (sourceMacroIndex !== targetMacroIndex) return;

        const macro = macroEntries[sourceMacroIndex];
        if (!macro) return;

        const sourceRest = source.slice(1);
        const targetRest = targetArrayPath.slice(1);

        if (sourceRest[0] !== 'body' || targetRest[0] !== 'body') return;

        const sourcePathInCommands = sourceRest.slice(1);
        const targetArrayPathInCommands = targetRest.slice(1);

        if (sourcePathInCommands.length === 0) return;

        const movedCommands = moveNodeByPathUtil(
            macro.commands,
            sourcePathInCommands,
            targetArrayPathInCommands,
            targetIndex
        );

        const next = [...macroEntries];
        next[sourceMacroIndex] = {
            ...macro,
            commands: movedCommands,
        };
        setMacroEntries(next);
    };

    const handleNodeDrop = (e: DragEvent, arrayPath: ScriptPath, index: number) => {
        e.preventDefault();
        e.stopPropagation();

        const source = dragSourceRef.current;
        const sources = dragSourcesRef.current;

        dragSourceRef.current = null;
        dragSourcesRef.current = null;

        if (sources && sources.length > 1) {
            if (arrayPath.length === 0) {
                if (editingAllMacrosFile) {
                    const from = sources.map((p) => p[0] as number);
                    moveMacroEntries(from, index);
                    syncRootSelectionAfterMultiMove(sources.length);
                } else {
                    moveNodesByPathsToArray(sources, arrayPath, index);
                    syncRootSelectionAfterMultiMove(sources.length);
                }
            }
            setDropIndicator(null);
            return;
        }

        if (!source) {
            setDropIndicator(null);
            return;
        }

        if (isDescendantPath(arrayPath, source)) {
            setDropIndicator(null);
            return;
        }

        if (editingAllMacrosFile) {
            if (source.length === 1 && arrayPath.length === 0) {
                moveMacroEntries([source[0] as number], index);
                setDropIndicator(null);
                return;
            }

            if (source.length > 1) {
                moveInsideMacroCommands(source, arrayPath, index);
                setDropIndicator(null);
                return;
            }
        }

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