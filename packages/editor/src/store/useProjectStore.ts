import { create } from 'zustand';
import type { DirEntry } from '@tauri-apps/plugin-fs';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { useScriptStore } from './useScriptStore';

export type MacroEntry = { name: string; commands: any[] };

interface ProjectState {
    projectPath: string | null;
    files: DirEntry[];
    activeFile: string | null;

    activeMacroName: string | null;
    setActiveMacroName: (name: string | null) => void;
    saveActiveMacroFromScript: (script: any[]) => void;
    saveActiveFileFromCurrentScript: () => Promise<void>;

    editingAllMacrosFile: boolean;
    setEditingAllMacrosFile: (v: boolean) => void;

    macroEntries: MacroEntry[];
    setMacroEntries: (entries: MacroEntry[]) => void;
    addMacroEntry: (name?: string) => void;
    renameMacroEntry: (index: number, nextName: string) => void;
    removeMacroEntry: (index: number) => void;
    updateMacroCommands: (index: number, commands: any[]) => void;

    moveMacroEntries: (fromIndices: number[], targetIndex: number) => void;
    duplicateMacroEntries: (indices: number[]) => void;
    deleteMacroEntries: (indices: number[]) => void;

    manifest: any | null;
    characters: Record<string, any>;
    items: Record<string, any>;
    macros: Record<string, any[]>;
    scenes: Record<string, any[]>;

    setProject: (path: string, files: DirEntry[]) => void;
    loadManifest: () => Promise<void>;
    setActiveFile: (file: string, content: any[]) => void;
}

async function resolveManifestValueFromDisk<T>(value: T | string, projectPath: string): Promise<T> {
    if (typeof value === 'string') {
        const filePath = projectPath + value;
        const text = await readTextFile(filePath);
        return JSON.parse(text);
    }
    return value as T;
}

async function resolveScenesDisk(
    scenes: Record<string, any>,
    projectPath: string
): Promise<Record<string, any[]>> {
    const resolved: Record<string, any[]> = {};
    await Promise.all(
        Object.entries(scenes).map(async ([name, value]) => {
            resolved[name] = await resolveManifestValueFromDisk<any[]>(value, projectPath);
        })
    );
    return resolved;
}

function uniqueMacroName(existing: string[], base = 'new_macro') {
    if (!existing.includes(base)) return base;
    let i = 2;
    while (existing.includes(`${base}_${i}`)) i++;
    return `${base}_${i}`;
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
    projectPath: null,
    files: [],
    activeFile: null,

    activeMacroName: null,
    setActiveMacroName: (name) => set({ activeMacroName: name }),

    editingAllMacrosFile: false,
    setEditingAllMacrosFile: (v) => set({ editingAllMacrosFile: v }),

    macroEntries: [],
    setMacroEntries: (entries) => set({ macroEntries: entries }),

    addMacroEntry: (name) =>
        set((state) => {
            const taken = state.macroEntries.map((m) => m.name);
            const next = name?.trim() ? name.trim() : uniqueMacroName(taken);
            if (taken.includes(next)) return {};
            return { macroEntries: [...state.macroEntries, { name: next, commands: [] }] };
        }),

    renameMacroEntry: (index, nextName) =>
        set((state) => {
            const clean = nextName.trim();
            if (!clean) return {};
            if (state.macroEntries.some((m, i) => i !== index && m.name === clean)) return {};
            const next = [...state.macroEntries];
            if (!next[index]) return {};
            next[index] = { ...next[index], name: clean };
            return { macroEntries: next };
        }),

    removeMacroEntry: (index) =>
        set((state) => ({
            macroEntries: state.macroEntries.filter((_, i) => i !== index),
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

                const taken = new Set(next.map((m) => m.name));
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
            return { macroEntries: state.macroEntries.filter((_, i) => !doomed.has(i)) };
        }),

    saveActiveMacroFromScript: (script) => {
        const { activeMacroName, macros } = get();
        if (!activeMacroName) return;
        set({ macros: { ...macros, [activeMacroName]: script } });
    },

    saveActiveFileFromCurrentScript: async () => {
        const { activeFile, activeMacroName, editingAllMacrosFile, macroEntries } = get();
        if (!activeFile) return;

        const rootScript = useScriptStore.getState().rootScript;

        try {
            if (editingAllMacrosFile) {
                const out: Record<string, any[]> = {};
                for (const m of macroEntries) out[m.name] = Array.isArray(m.commands) ? m.commands : [];
                await writeTextFile(activeFile, JSON.stringify(out, null, 4));
                return;
            }

            if (activeMacroName) {
                const raw = await readTextFile(activeFile);
                const obj = JSON.parse(raw);
                obj[activeMacroName] = rootScript;
                await writeTextFile(activeFile, JSON.stringify(obj, null, 4));
            } else {
                await writeTextFile(activeFile, JSON.stringify(rootScript, null, 4));
            }
        } catch (err) {
            console.error('Failed to save active file:', err);
        }
    },

    manifest: null,
    characters: {},
    items: {},
    macros: {},
    scenes: {},

    setProject: (path, files) =>
        set({
            projectPath: path,
            files,
            activeFile: null,
            manifest: null,
            characters: {},
            items: {},
            macros: {},
            scenes: {},
            activeMacroName: null,
            editingAllMacrosFile: false,
            macroEntries: [],
        }),

    loadManifest: async () => {
        const { projectPath } = get();
        if (!projectPath) return;

        try {
            const manifestText = await readTextFile(projectPath + '/game.json');
            const manifest = JSON.parse(manifestText);

            const [characters, items, macros, scenes] = await Promise.all([
                manifest.characters ? resolveManifestValueFromDisk(manifest.characters, projectPath) : Promise.resolve({}),
                manifest.items ? resolveManifestValueFromDisk(manifest.items, projectPath) : Promise.resolve({}),
                manifest.macros ? resolveManifestValueFromDisk(manifest.macros, projectPath) : Promise.resolve({}),
                manifest.scenes ? resolveScenesDisk(manifest.scenes, projectPath) : Promise.resolve({}),
            ]);

            set({ manifest, characters, items, macros, scenes });
        } catch (err) {
            console.error('Failed to load manifest:', err);
        }
    },

    setActiveFile: (file, content) => {
        set({ activeFile: file });
        useScriptStore.getState().setScript(content);
    },
}));