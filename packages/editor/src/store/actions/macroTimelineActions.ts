import { useEditorStore } from '../useEditorStore';
import { useProjectStore } from '../useProjectStore';

export type MacroTimelineAction = 'deleteSelected' | 'duplicateSelected';

export function executeMacroTimelineAction(action: MacroTimelineAction): void {
    const editorState = useEditorStore.getState();
    const projectState = useProjectStore.getState();

    const first = editorState.selectedNodePaths[0];
    const selectedMacroIndex = first && typeof first[0] === 'number' ? (first[0]) : null;

    if (selectedMacroIndex === null) return;

    if (action === 'duplicateSelected') {
        const selectedMacro = projectState.macroEntries[selectedMacroIndex];
        if (!selectedMacro) return;

        const taken = new Set(projectState.macroEntries.map((m) => m.name));
        const base = `${selectedMacro.name}_copy`;
        let nextName = base;
        let index = 2;
        while (taken.has(nextName)) {
            nextName = `${base}_${index}`;
            index++;
        }

        const next = [...projectState.macroEntries];
        next.splice(selectedMacroIndex + 1, 0, {
            commands:
                typeof structuredClone === 'function'
                    ? structuredClone(selectedMacro.commands)
                    : JSON.parse(JSON.stringify(selectedMacro.commands)),
            name: nextName,
        });

        projectState.setMacroEntries(next);
        editorState.setSelectedNodePaths([[selectedMacroIndex + 1]]);
        editorState.setSelectionAnchorPath([selectedMacroIndex + 1]);
        return;
    }

    projectState.removeMacroEntry(selectedMacroIndex);
    const nextIndex = Math.max(0, selectedMacroIndex - 1);
    const hasAnyLeft = projectState.macroEntries.length - 1 > 0;
    editorState.setSelectedNodePaths(hasAnyLeft ? [[nextIndex]] : []);
    editorState.setSelectionAnchorPath(hasAnyLeft ? [nextIndex] : null);
}

