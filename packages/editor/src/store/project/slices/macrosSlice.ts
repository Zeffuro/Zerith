import type { MacroEntry, ProjectGet, ProjectMacrosSlice, ProjectSet } from '../types';

function uniqueMacroName(existing: string[], base = 'new_macro') {
    if (!existing.includes(base)) return base;
    let i = 2;
    while (existing.includes(`${base}_${i}`)) i++;
    return `${base}_${i}`;
}

export function createProjectMacrosSlice(set: ProjectSet, get: ProjectGet): ProjectMacrosSlice {
    return {
        activeMacroName: null,
        setActiveMacroName: (name) => set({ activeMacroName: name }),

        editingAllMacrosFile: false,
        setEditingAllMacrosFile: (v) => set({ editingAllMacrosFile: v }),

        macroEntries: [],
        setMacroEntries: (entries: MacroEntry[]) => set({ macroEntries: entries }),

        addMacroEntry: (name) =>
            set((state) => {
                const taken = state.macroEntries.map((m: MacroEntry) => m.name);
                const next = name?.trim() ? name.trim() : uniqueMacroName(taken);
                if (taken.includes(next)) return {};
                return { macroEntries: [...state.macroEntries, { name: next, commands: [] }] };
            }),

        renameMacroEntry: (index, nextName) =>
            set((state) => {
                const clean = nextName.trim();
                if (!clean) return {};
                if (state.macroEntries.some((m: MacroEntry, i: number) => i !== index && m.name === clean)) return {};
                const next = [...state.macroEntries];
                if (!next[index]) return {};
                next[index] = { ...next[index], name: clean };
                return { macroEntries: next };
            }),

        removeMacroEntry: (index) =>
            set((state) => ({
                macroEntries: state.macroEntries.filter((_: MacroEntry, i: number) => i !== index),
            })),

        updateMacroCommands: (index, commands) =>
            set((state) => {
                const next = [...state.macroEntries];
                if (!next[index]) return {};
                next[index] = { ...next[index], commands };
                return { macroEntries: next };
            }),

        moveMacroEntries: (fromIndices, targetIndex) =>
            set((state) => {
                const uniqueSorted = Array.from(new Set(fromIndices)).sort((a, b) => a - b);
                if (uniqueSorted.length === 0) return {};

                const first = uniqueSorted[0];
                const last = uniqueSorted[uniqueSorted.length - 1];
                const dropInsideBlock = targetIndex >= first && targetIndex <= last + 1;
                if (dropInsideBlock) return {};

                const src = [...state.macroEntries];
                const moving = uniqueSorted.map((i) => src[i]).filter(Boolean);
                if (moving.length === 0) return {};

                for (let i = uniqueSorted.length - 1; i >= 0; i--) src.splice(uniqueSorted[i], 1);

                const removedBefore = uniqueSorted.filter((i) => i < targetIndex).length;
                let insertAt = targetIndex - removedBefore;
                if (insertAt < 0) insertAt = 0;
                if (insertAt > src.length) insertAt = src.length;

                src.splice(insertAt, 0, ...moving);
                return { macroEntries: src };
            }),

        duplicateMacroEntries: (indices) =>
            set((state) => {
                const sorted = Array.from(new Set(indices)).sort((a, b) => a - b);
                if (sorted.length === 0) return {};

                const next = [...state.macroEntries];
                let inserted = 0;

                for (const idx of sorted) {
                    const sourceIndex = idx + inserted;
                    const source = next[sourceIndex];
                    if (!source) continue;

                    const taken = new Set(next.map((m: MacroEntry) => m.name));
                    let copyName = `${source.name}_copy`;
                    let i = 2;
                    while (taken.has(copyName)) copyName = `${source.name}_copy_${i++}`;

                    const clone = typeof structuredClone === 'function'
                        ? structuredClone(source.commands)
                        : JSON.parse(JSON.stringify(source.commands));

                    next.splice(sourceIndex + 1, 0, { name: copyName, commands: clone });
                    inserted += 1;
                }

                return { macroEntries: next };
            }),

        deleteMacroEntries: (indices) =>
            set((state) => {
                const doomed = new Set(indices);
                return { macroEntries: state.macroEntries.filter((_: MacroEntry, i: number) => !doomed.has(i)) };
            }),

        saveActiveMacroFromScript: (script) => {
            const { activeMacroName, macros } = get();
            if (!activeMacroName) return;
            set({ macros: { ...macros, [activeMacroName]: script } });
        },
    };
}

