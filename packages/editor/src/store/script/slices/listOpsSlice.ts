import type { ScriptSlice, ScriptState } from '../types';

import { getNestedArray, updateDeepScript } from '../../../utils/scriptUtilities';
import { MAX_HISTORY } from '../constants';

type ListOpsSlice = Pick<
    ScriptState,
    'addNode' | 'deleteNode' | 'getActiveScript' | 'moveNode' | 'updateActiveScript'
>;

export const createListOpsSlice: ScriptSlice<ListOpsSlice> = (set, get) => ({
    addNode: (node) => {
        const { getActiveScript, selectedNodeIndex, updateActiveScript } = get();
        const currentList = getActiveScript();

        const index = selectedNodeIndex === undefined ? currentList.length : selectedNodeIndex + 1;
        const newList = [...currentList];
        newList.splice(index, 0, node);

        updateActiveScript(newList);

        const scope = get().scopePath;
        set({
            selectedNodeIndex: index,
            selectedNodePath: [...scope, index],
        });
    },

    deleteNode: (index) => {
        const { getActiveScript, selectedNodeIndex, updateActiveScript } = get();
        const newList = getActiveScript().filter((_, index_) => index_ !== index);

        updateActiveScript(newList);

        const nextIndex =
            selectedNodeIndex === index
                ? undefined
                : (selectedNodeIndex !== undefined && selectedNodeIndex > index
                    ? selectedNodeIndex - 1
                    : selectedNodeIndex);

        const scope = get().scopePath;
        set({
            selectedNodeIndex: nextIndex,
            selectedNodePath: nextIndex === undefined ? undefined : [...scope, nextIndex],
        });
    },

    getActiveScript: () => {
        const { rootScript, scopePath } = get();
        return getNestedArray(rootScript, scopePath);
    },

    moveNode: (index, direction) => {
        const { getActiveScript, updateActiveScript } = get();
        const currentList = getActiveScript();

        if (index < 0 || index >= currentList.length) return;
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

    updateActiveScript: (newSubArray) =>
        set((state) => ({
            future: [],
            past: [...state.past, state.rootScript].slice(-MAX_HISTORY),
            rootScript: updateDeepScript(state.rootScript, state.scopePath, newSubArray),
        })),
});
