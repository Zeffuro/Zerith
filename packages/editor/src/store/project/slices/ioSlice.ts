import type { Command } from 'core';

import type { ProjectGet, ProjectIoSlice, ProjectScriptBridge } from '../types';

import { fsReadDir, fsReadTextFile, fsWriteTextFile } from '../../../services/fs';

export function createProjectIoSlice(get: ProjectGet, scriptBridge: ProjectScriptBridge): ProjectIoSlice {
    return {
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
            } catch (error) {
                console.error('Failed to open project:', error);
            }
        },

        saveActiveFileFromCurrentScript: async () => {
            const { activeFile, activeMacroName, editingAllMacrosFile, macroEntries } = get();
            if (!activeFile) return;

            const rootScript = scriptBridge.getRootScript();

            try {
                if (editingAllMacrosFile) {
                    const out: Record<string, Command[]> = {};
                    for (const m of macroEntries) out[m.name] = Array.isArray(m.commands) ? m.commands : [];
                    await fsWriteTextFile(activeFile, JSON.stringify(out, null, 4));
                    return;
                }

                if (activeMacroName) {
                    const raw = await fsReadTextFile(activeFile);
                    const object = JSON.parse(raw);
                    object[activeMacroName] = rootScript;
                    await fsWriteTextFile(activeFile, JSON.stringify(object, null, 4));
                } else {
                    await fsWriteTextFile(activeFile, JSON.stringify(rootScript, null, 4));
                }
            } catch (error) {
                console.error('Failed to save active file:', error);
            }
        },
    };
}

