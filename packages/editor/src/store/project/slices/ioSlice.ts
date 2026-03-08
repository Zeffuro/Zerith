import { fsReadDir, fsReadTextFile, fsWriteTextFile } from '../../../services/fs';
import type { Command } from 'core';
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
                    const out: Record<string, Command[]> = {};
                    for (const m of macroEntries) out[m.name] = Array.isArray(m.commands) ? m.commands : [];
                    await fsWriteTextFile(activeFile, JSON.stringify(out, null, 4));
                    return;
                }

                if (activeMacroName) {
                    const raw = await fsReadTextFile(activeFile);
                    const obj = JSON.parse(raw);
                    obj[activeMacroName] = rootScript;
                    await fsWriteTextFile(activeFile, JSON.stringify(obj, null, 4));
                } else {
                    await fsWriteTextFile(activeFile, JSON.stringify(rootScript, null, 4));
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
                const entries = await fsReadDir(projectRoot);
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

