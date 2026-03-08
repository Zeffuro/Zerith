import type { MacroEntry, ProjectGet, ProjectMacrosSlice, ProjectSet } from '../types';

export function createProjectMacrosSlice(set: ProjectSet, get: ProjectGet): ProjectMacrosSlice {
    return {
        activeMacroName: null,
        addMacroEntry: (name) =>
            set((state) => {
                const taken = state.macroEntries.map((m: MacroEntry) => m.name);
                const next = name?.trim() ? name.trim() : uniqueMacroName(taken);
                if (taken.includes(next)) return {};
                return { macroEntries: [...state.macroEntries, { commands: [], name: next }] };
            }),

        deleteMacroEntries: (indices) =>
            set((state) => {
                const doomed = new Set(indices);
                return { macroEntries: state.macroEntries.filter((_: MacroEntry, index: number) => !doomed.has(index)) };
            }),
        duplicateMacroEntries: (indices) =>
            set((state) => {
                const sorted = [...new Set(indices)].sort((a, b) => a - b);
                if (sorted.length === 0) return {};

                const next = [...state.macroEntries];
                let inserted = 0;

                for (const index of sorted) {
                    const sourceIndex = index + inserted;
                    const source = next[sourceIndex];
                    if (!source) continue;

                    const taken = new Set(next.map((m: MacroEntry) => m.name));
                    let copyName = `${source.name}_copy`;
                    let index_ = 2;
                    while (taken.has(copyName)) copyName = `${source.name}_copy_${index_++}`;

                    const clone = typeof structuredClone === 'function'
                        ? structuredClone(source.commands)
                        : JSON.parse(JSON.stringify(source.commands));

                    next.splice(sourceIndex + 1, 0, { commands: clone, name: copyName });
                    inserted += 1;
                }

                return { macroEntries: next };
            }),

        editingAllMacrosFile: false,
        macroEntries: [],

        moveMacroEntries: (fromIndices, targetIndex) =>
            set((state) => {
                const uniqueSorted = [...new Set(fromIndices)].sort((a, b) => a - b);
                if (uniqueSorted.length === 0) return {};

                const first = uniqueSorted[0];
                const last = uniqueSorted.at(-1);
                const dropInsideBlock = targetIndex >= first && targetIndex <= last + 1;
                if (dropInsideBlock) return {};

                const source = [...state.macroEntries];
                const moving = uniqueSorted.map((index) => source[index]).filter(Boolean);
                if (moving.length === 0) return {};

                for (let index = uniqueSorted.length - 1; index >= 0; index--) source.splice(uniqueSorted[index], 1);

                const removedBefore = uniqueSorted.filter((index) => index < targetIndex).length;
                let insertAt = targetIndex - removedBefore;
                if (insertAt < 0) insertAt = 0;
                if (insertAt > source.length) insertAt = source.length;

                source.splice(insertAt, 0, ...moving);
                return { macroEntries: source };
            }),

        removeMacroEntry: (index) =>
            set((state) => ({
                macroEntries: state.macroEntries.filter((_: MacroEntry, index_: number) => index_ !== index),
            })),

        renameMacroEntry: (index, nextName) =>
            set((state) => {
                const clean = nextName.trim();
                if (!clean) return {};
                if (state.macroEntries.some((m: MacroEntry, index_: number) => index_ !== index && m.name === clean)) return {};
                const next = [...state.macroEntries];
                if (!next[index]) return {};
                next[index] = { ...next[index], name: clean };
                return { macroEntries: next };
            }),

        saveActiveMacroFromScript: (script) => {
            const { activeMacroName, macros } = get();
            if (!activeMacroName) return;
            set({ macros: { ...macros, [activeMacroName]: script } });
        },

        setActiveMacroName: (name) => set({ activeMacroName: name }),

        setEditingAllMacrosFile: (v) => set({ editingAllMacrosFile: v }),

        setMacroEntries: (entries: MacroEntry[]) => set({ macroEntries: entries }),

        updateMacroCommands: (index, commands) =>
            set((state) => {
                const next = [...state.macroEntries];
                if (!next[index]) return {};
                next[index] = { ...next[index], commands };
                return { macroEntries: next };
            }),
    };
}

function uniqueMacroName(existing: string[], base = 'new_macro') {
    if (!existing.includes(base)) return base;
    let index = 2;
    while (existing.includes(`${base}_${index}`)) index++;
    return `${base}_${index}`;
}

