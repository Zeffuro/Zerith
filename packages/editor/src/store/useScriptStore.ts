import { create } from 'zustand';
import { getNestedArray, updateDeepScript } from '../utils/scriptUtils';

interface ScriptState {
    rootScript: any[];
    scopePath: (string | number)[];
    selectedNodeIndex: number | null;

    // Actions
    setScript: (script: any[]) => void;
    getActiveScript: () => any[];

    pushScope: (index: number, branch: string) => void;
    popScope: () => void;
    resetScope: () => void;

    setSelectedNode: (index: number | null) => void;

    // Manipulation
    updateActiveScript: (newSubArray: any[]) => void;
    moveNode: (index: number, direction: 'up' | 'down') => void;
    deleteNode: (index: number) => void;
    addNode: (node: any) => void;
}

export const useScriptStore = create<ScriptState>((set, get) => ({
    rootScript: [],
    scopePath: [],
    selectedNodeIndex: null,

    setScript: (script) => set({ rootScript: script, scopePath: [], selectedNodeIndex: null }),

    getActiveScript: () => {
        const { rootScript, scopePath } = get();
        return getNestedArray(rootScript, scopePath);
    },

    pushScope: (index, branch) => set(state => ({
        scopePath: [...state.scopePath, index, branch],
        selectedNodeIndex: null
    })),

    popScope: () => set(state => {
        const newPath = [...state.scopePath];
        newPath.pop();
        newPath.pop();
        return { scopePath: newPath, selectedNodeIndex: null };
    }),

    resetScope: () => set({ scopePath: [], selectedNodeIndex: null }),
    setSelectedNode: (index) => set({ selectedNodeIndex: index }),

    updateActiveScript: (newSubArray) => set(state => ({
        rootScript: updateDeepScript(state.rootScript, state.scopePath, newSubArray)
    })),

    moveNode: (index, direction) => {
        const { getActiveScript, updateActiveScript } = get();
        const currentList = getActiveScript();

        if (index === null || index < 0 || index >= currentList.length) return;
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= currentList.length) return;

        const newList = [...currentList];
        [newList[index], newList[newIndex]] = [newList[newIndex], newList[index]];

        updateActiveScript(newList);
        set({ selectedNodeIndex: newIndex });
    },

    deleteNode: (index) => {
        const { getActiveScript, updateActiveScript, selectedNodeIndex } = get();
        const newList = getActiveScript().filter((_, i) => i !== index);

        updateActiveScript(newList);
        set({
            selectedNodeIndex: selectedNodeIndex === index ? null : (selectedNodeIndex !== null && selectedNodeIndex > index ? selectedNodeIndex - 1 : selectedNodeIndex)
        });
    },

    addNode: (node) => {
        const { getActiveScript, updateActiveScript, selectedNodeIndex } = get();
        const currentList = getActiveScript();

        const index = selectedNodeIndex !== null ? selectedNodeIndex + 1 : currentList.length;
        const newList = [...currentList];
        newList.splice(index, 0, node);

        updateActiveScript(newList);
        set({ selectedNodeIndex: index });
    }
}));