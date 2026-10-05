import { useEffect, useRef } from 'react';

import { scriptMatchesSavedBaseline } from '../services/scriptSavedBaseline';
import { serializeMacroEntries, serializeSceneCommands, visualTabSourceText } from '../services/visualWorkbenchContent';
import { useProjectStore } from '../store/storeBootstrap';
import { useScriptStore } from '../store/storeBootstrap';
import { useWorkbenchStore } from '../store/useWorkbenchStore';

export function useScriptDirtyTracking() {
    const activeFile = useProjectStore((state) => state.activeFile);
    const markFileDirty = useProjectStore((state) => state.markFileDirty);
    const editingAllMacrosFile = useProjectStore((state) => state.editingAllMacrosFile);
    const macroEntries = useProjectStore((state) => state.macroEntries);
    const projectGeneration = useProjectStore((state) => state.projectGeneration);
    const rootScript = useScriptStore((state) => state.rootScript);

    const previousActiveFileReference = useRef<string | undefined>(undefined);
    const previousSignatureReference = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (!activeFile) {
            previousActiveFileReference.current = undefined;
            return;
        }

        const session = `${projectGeneration}:${activeFile}:${editingAllMacrosFile}`;
        const signature = JSON.stringify(editingAllMacrosFile ? macroEntries : rootScript);
        const switchedFiles = previousActiveFileReference.current !== session;
        previousActiveFileReference.current = session;

        if (switchedFiles || previousSignatureReference.current === undefined) {
            previousSignatureReference.current = signature;
            return;
        }

        if (previousSignatureReference.current !== signature) {
            previousSignatureReference.current = signature;
            const workbench = useWorkbenchStore.getState();
            const tab = workbench.tabs.find(entry => entry.path === activeFile && (entry.kind === 'script' || entry.kind === 'macros'));
            if (tab) {
                if (!tab.dirty && scriptMatchesSavedBaseline(tab.savedTextContent, rootScript, macroEntries, editingAllMacrosFile, useProjectStore.getState().activeMacroName)) return;
                const source = visualTabSourceText(tab);
                const text = editingAllMacrosFile
                    ? serializeMacroEntries(macroEntries, source)
                    : serializeSceneCommands(rootScript, source);
                workbench.updateTabContent(tab.id, text);
            } else {
                markFileDirty(activeFile);
            }
        }
    }, [activeFile, editingAllMacrosFile, macroEntries, markFileDirty, projectGeneration, rootScript]);
}

