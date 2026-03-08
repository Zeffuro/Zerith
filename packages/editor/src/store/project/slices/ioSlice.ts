import { readDir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { useScriptStore } from '../../useScriptStore';
import type { ProjectGet, ProjectIoSlice } from '../types';

export function createProjectIoSlice(get: ProjectGet): ProjectIoSlice {
    return {
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

        openProjectFromManifest: async (manifestPath: string) => {
            const separator = manifestPath.includes('\\') ? '\\' : '/';
            const pathParts = manifestPath.split(separator);
            pathParts.pop();
            const projectRoot = pathParts.join(separator);

            try {
                const entries = await readDir(projectRoot);
                entries.sort((a, b) => {
                    if (a.isDirectory && !b.isDirectory) return -1;
                    if (!a.isDirectory && b.isDirectory) return 1;
                    return a.name.localeCompare(b.name);
                });

                get().setProject(projectRoot, entries);
                await get().loadManifest();
            } catch (err) {
                console.error('Failed to open project:', err);
            }
        },
    };
}

