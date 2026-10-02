import type { ProjectGet, ProjectIoSlice, ProjectScriptBridge } from '../types';

import { fsReadDirectory, fsReadTextFile } from '../../../services/fs';
import { saveAllFiles } from '../../../services/saveAllFiles';
import { saveWorkbenchTextFile as fsWriteTextFile } from '../../../services/saveWorkbenchFile';
import { serializeMacroEntries, serializeSceneCommands, visualTabSourceText } from '../../../services/visualWorkbenchContent';
import { isRecord } from '../../../utils/typeGuards';
import { useWorkbenchStore } from '../../useWorkbenchStore';

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
            const { activeFile, activeMacroName, editingAllMacrosFile, macroEntries, projectGeneration } = get();
            if (!activeFile) return;

            const rootScript = scriptBridge.getRootScript();
            const workbench = useWorkbenchStore.getState();
            const tab = workbench.tabs.find(entry => entry.path === activeFile);
            const sourceText = visualTabSourceText(tab);

            try {
                if (editingAllMacrosFile) {
                    const content = serializeMacroEntries(macroEntries, sourceText);
                    await fsWriteTextFile(activeFile, content);
                    if (get().projectGeneration === projectGeneration && get().macroEntries === macroEntries) {
                        if (tab) useWorkbenchStore.getState().updateTabContent(tab.id, content, { markDirty: false });
                        get().clearFileDirty(activeFile);
                    }
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
                    const content = serializeSceneCommands(rootScript, sourceText ?? await fsReadTextFile(activeFile));
                    await fsWriteTextFile(activeFile, content);
                    if (tab && get().projectGeneration === projectGeneration && scriptBridge.getRootScript() === rootScript) {
                        useWorkbenchStore.getState().updateTabContent(tab.id, content, { markDirty: false });
                    }
                }

                if (get().projectGeneration === projectGeneration && scriptBridge.getRootScript() === rootScript) get().clearFileDirty(activeFile);
            } catch (error) {
                console.error('Failed to save active file:', error);
            }
        },

        saveAllDirtyFiles: async () => {
            return saveAllFiles(get);
        },
    };
}


