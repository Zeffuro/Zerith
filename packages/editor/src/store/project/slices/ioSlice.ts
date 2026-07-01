import type { Command } from 'zerith-core';

import type { ProjectGet, ProjectIoSlice, ProjectScriptBridge } from '../types';

import { fsReadDirectory, fsReadTextFile, fsWriteTextFile } from '../../../services/fs';
import { saveAllFiles } from '../../../services/saveAllFiles';
import { isRecord } from '../../../utils/typeGuards';

export function createProjectIoSlice(get: ProjectGet, scriptBridge: ProjectScriptBridge): ProjectIoSlice {
    return {
        openProjectFromManifest: async (manifestPath: string) => {
            const separator = manifestPath.includes('\\') ? '\\' : '/';
            const pathParts = manifestPath.split(separator);
            pathParts.pop();
            const projectRoot = pathParts.join(separator);

            try {
                const entries = await fsReadDirectory(projectRoot);
                const sortedEntries = entries.toSorted((a, b) => {
                    if (a.isDirectory && !b.isDirectory) return -1;
                    if (!a.isDirectory && b.isDirectory) return 1;
                    return a.name.localeCompare(b.name);
                });

                get().setProject(projectRoot, sortedEntries);
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
                    await fsWriteTextFile(activeFile, JSON.stringify(out, undefined, 4));
                    get().clearFileDirty(activeFile);
                    return;
                }

                if (activeMacroName) {
                    const raw = await fsReadTextFile(activeFile);
                    const parsed: unknown = JSON.parse(raw);
                    if (!isRecord(parsed)) {
                        throw new TypeError('Macro file must be a JSON object');
                    }
                    parsed[activeMacroName] = rootScript;
                    await fsWriteTextFile(activeFile, JSON.stringify(parsed, undefined, 4));
                } else {
                    await fsWriteTextFile(activeFile, JSON.stringify(rootScript, undefined, 4));
                }

                get().clearFileDirty(activeFile);
            } catch (error) {
                console.error('Failed to save active file:', error);
            }
        },

        saveAllDirtyFiles: async () => {
            return saveAllFiles(get);
        },
    };
}


