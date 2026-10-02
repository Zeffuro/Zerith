import type { ProjectGet, ProjectIoSlice, ProjectScriptBridge } from '../types';

import { fsReadTextFile } from '../../../services/fs';
import { saveAllFiles } from '../../../services/saveAllFiles';
import { saveWorkbenchTextFile as fsWriteTextFile } from '../../../services/saveWorkbenchFile';
import { serializeMacroEntries, serializeSceneCommands, visualTabSourceText } from '../../../services/visualWorkbenchContent';
import { isRecord } from '../../../utils/typeGuards';
import { useWorkbenchStore } from '../../useWorkbenchStore';
import { prepareProjectOpen } from '../projectPreparation';

export function createProjectIoSlice(get: ProjectGet, scriptBridge: ProjectScriptBridge): ProjectIoSlice {
    let openSequence = 0;
    return {
        openProjectFromManifest: async (manifestPath, prepared) => {
            const { projectGeneration, projectPath } = get();
            const sequence = ++openSequence;
            try {
                const loaded = prepared ?? await prepareProjectOpen(manifestPath);
                if (loaded.manifestPath !== manifestPath) throw new Error('Prepared project does not match the selected manifest.');
                if (get().projectGeneration !== projectGeneration || get().projectPath !== projectPath || sequence !== openSequence) return false;
                get().setProject(loaded.projectRoot, loaded.files, loaded.manifestData);
                return get().projectPath === loaded.projectRoot && get().projectGeneration === projectGeneration + 1;
            } catch (error) {
                console.error('Failed to open project:', error);
                return false;
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


