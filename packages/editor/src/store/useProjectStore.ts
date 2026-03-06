import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DirEntry } from '@tauri-apps/plugin-fs';
import { readTextFile } from '@tauri-apps/plugin-fs';

const getNestedArray = (root: any[], path: (string | number)[]): any[] => {
    let current: any = root;
    for (const key of path) {
        if (current && typeof current === 'object' && key in current) {
            current = current[key];
        } else {
            return [];
        }
    }
    return Array.isArray(current) ? current : [];
};

const updateDeepScript = (root: any[], path: (string | number)[], newSubArray: any[]): any[] => {
    if (path.length === 0) return newSubArray;

    const newRoot = [...root];
    let current: any = newRoot;

    for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        current[key] = Array.isArray(current[key]) ? [...current[key]] : { ...current[key] };
        current = current[key];
    }

    const lastKey = path[path.length - 1];
    current[lastKey] = newSubArray;
    return newRoot;
};

interface ProjectState {
    projectPath: string | null;
    files: DirEntry[];
    manifest: any | null;
    characters: Record<string, any>;
    items: Record<string, any>;
    macros: Record<string, any[]>;
    scenes: Record<string, any[]>;

    // Persistent Settings
    uiScale: number;
    isMuted: boolean;
    windowState: { width: number; height: number; x: number; y: number; maximized: boolean } | null;

    // Triggers
    playTrigger: number;
    stopTrigger: number;

    // Editor Scope (For branching)
    scopePath: (string | number)[];

    // Actions
    setUiScale: (scale: number) => void;
    toggleMute: () => void;
    triggerPlay: () => void;
    triggerStop: () => void;
    setWindowState: (state: ProjectState['windowState']) => void;

    // Scope Actions
    pushScope: (index: number, branch: string) => void;
    popScope: () => void;
    resetScope: () => void;

    setProject: (path: string, files: DirEntry[]) => void;
    loadManifest: () => Promise<void>;

    activeFile: string | null;
    script: any[];

    getActiveScript: () => any[];

    selectedNodeIndex: number | null;

    setActiveFile: (file: string, content: any[]) => void;

    updateScript: (newSubArray: any[]) => void;
    setSelectedNode: (index: number | null) => void;
    moveNode: (index: number, direction: 'up' | 'down') => void;
    deleteNode: (index: number) => void;
}

async function resolveManifestValueFromDisk<T>(
    value: T | string,
    projectPath: string
): Promise<T> {
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

export const useProjectStore = create<ProjectState>()(
    persist(
        (set, get) => ({
            projectPath: null,
            files: [],
            manifest: null,
            characters: {},
            items: {},
            macros: {},
            scenes: {} as Record<string, any[]>,

            uiScale: 1.0,
            isMuted: false,
            windowState: null,

            playTrigger: 0,
            stopTrigger: 0,
            scopePath: [],

            setUiScale: (scale) => set({ uiScale: scale }),
            toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
            triggerPlay: () => set((state) => ({ playTrigger: state.playTrigger + 1 })),
            triggerStop: () => set((state) => ({ stopTrigger: state.stopTrigger + 1 })),
            setWindowState: (ws) => set({ windowState: ws }),

            pushScope: (index, branch) => set(state => ({
                scopePath: [...state.scopePath, index, branch],
                selectedNodeIndex: null
            })),
            popScope: () => set(state => {
                const newPath = [...state.scopePath];
                newPath.pop(); // pop branch
                newPath.pop(); // pop index
                return { scopePath: newPath, selectedNodeIndex: null };
            }),
            resetScope: () => set({ scopePath: [], selectedNodeIndex: null }),

            setProject: (path, files) => set({
                projectPath: path,
                files,
                activeFile: null,
                script: [],
                selectedNodeIndex: null,
                manifest: null,
                characters: {},
                items: {},
                macros: {},
                scenes: {},
            }),

            loadManifest: async () => {
                const { projectPath } = get();
                if (!projectPath) return;

                try {
                    const manifestText = await readTextFile(projectPath + '/game.json');
                    const manifest = JSON.parse(manifestText);

                    const [characters, items, macros, scenes] = await Promise.all([
                        manifest.characters
                            ? resolveManifestValueFromDisk(manifest.characters, projectPath)
                            : Promise.resolve({}),
                        manifest.items
                            ? resolveManifestValueFromDisk(manifest.items, projectPath)
                            : Promise.resolve({}),
                        manifest.macros
                            ? resolveManifestValueFromDisk(manifest.macros, projectPath)
                            : Promise.resolve({}),
                        manifest.scenes
                            ? resolveScenesDisk(manifest.scenes, projectPath)
                            : Promise.resolve({}),
                    ]);

                    set({ manifest, characters, items, macros, scenes });
                } catch (err) {
                    console.error('Failed to load manifest:', err);
                }
            },

            activeFile: null,
            script: [],
            selectedNodeIndex: null,

            getActiveScript: () => {
                const { script, scopePath } = get();
                return getNestedArray(script, scopePath);
            },

            setActiveFile: (file, content) => set({
                activeFile: file,
                script: content,
                selectedNodeIndex: null,
                scopePath: []
            }),

            updateScript: (newSubArray) => set(state => ({
                script: updateDeepScript(state.script, state.scopePath, newSubArray)
            })),
            setSelectedNode: (index) => set({ selectedNodeIndex: index }),
            moveNode: (index, direction) => {
                const { getActiveScript, updateScript } = get();
                const activeScript = getActiveScript();

                if (index === null || index < 0 || index >= activeScript.length) return;
                const newIndex = direction === 'up' ? index - 1 : index + 1;
                if (newIndex < 0 || newIndex >= activeScript.length) return;

                const newSubArray = [...activeScript];
                [newSubArray[index], newSubArray[newIndex]] = [newSubArray[newIndex], newSubArray[index]];

                updateScript(newSubArray);
                set({ selectedNodeIndex: newIndex });
            },

            deleteNode: (index) => {
                const { getActiveScript, updateScript, selectedNodeIndex } = get();
                const activeScript = getActiveScript();
                const newSubArray = activeScript.filter((_, i) => i !== index);

                updateScript(newSubArray);
                set({
                    selectedNodeIndex: selectedNodeIndex === index ? null : (selectedNodeIndex !== null && selectedNodeIndex > index ? selectedNodeIndex - 1 : selectedNodeIndex)
                });
            }
        }),
        {
            name: 'zerith-editor-storage',
            partialize: (state) => ({
                uiScale: state.uiScale,
                isMuted: state.isMuted,
                windowState: state.windowState
            }),
        }
    )
);