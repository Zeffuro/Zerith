import { getNestedArray, updateDeepScript } from '../../../utils/scriptUtils';
import { MAX_HISTORY } from '../constants';
import type { ScriptSlice, ScriptState } from '../types';

type ListOpsSlice = Pick<
    ScriptState,
    'getActiveScript' | 'updateActiveScript' | 'moveNode' | 'deleteNode' | 'addNode'
>;

export const createListOpsSlice: ScriptSlice<ListOpsSlice> = (set, get) => ({
    getActiveScript: () => {
        const { rootScript, scopePath } = get();
        return getNestedArray(rootScript, scopePath);
    },

    updateActiveScript: (newSubArray) =>
        set((state) => ({
            rootScript: updateDeepScript(state.rootScript, state.scopePath, newSubArray),
            past: [...state.past, state.rootScript].slice(-MAX_HISTORY),
            future: [],
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

        const scope = get().scopePath;
        set({
            selectedNodeIndex: newIndex,
            selectedNodePath: [...scope, newIndex],
        });
    },

    deleteNode: (index) => {
        const { getActiveScript, updateActiveScript, selectedNodeIndex } = get();
        const newList = getActiveScript().filter((_, i) => i !== index);

        updateActiveScript(newList);

        const nextIndex =
            selectedNodeIndex === index
                ? null
                : selectedNodeIndex !== null && selectedNodeIndex > index
                    ? selectedNodeIndex - 1
                    : selectedNodeIndex;

        const scope = get().scopePath;
        set({
            selectedNodeIndex: nextIndex,
            selectedNodePath: nextIndex === null ? null : [...scope, nextIndex],
        });
    },

    addNode: (node) => {
        const { getActiveScript, updateActiveScript, selectedNodeIndex } = get();
        const currentList = getActiveScript();

        const index = selectedNodeIndex !== null ? selectedNodeIndex + 1 : currentList.length;
        const newList = [...currentList];
        newList.splice(index, 0, node);

        updateActiveScript(newList);

        const scope = get().scopePath;
        set({
            selectedNodeIndex: index,
            selectedNodePath: [...scope, index],
        });
    },
});