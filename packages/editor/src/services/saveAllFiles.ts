import type { ProjectGet, SaveAllResult } from '../store/project/types';

import { useWorkbenchStore } from '../store/useWorkbenchStore';
import { fsWriteTextFile } from './fs';

export async function saveAllFiles(getProjectState: ProjectGet): Promise<SaveAllResult> {
    const state = getProjectState();
    const dirtyPaths = [...state.dirtyFiles];
    const result: SaveAllResult = { failed: [], saved: [], skipped: [] };

    if (dirtyPaths.length === 0) {
        return result;
    }

    if (state.activeFile && state.dirtyFiles.has(state.activeFile)) {
        await state.saveActiveFileFromCurrentScript();
        if (getProjectState().dirtyFiles.has(state.activeFile)) {
            result.failed.push(state.activeFile);
        } else {
            result.saved.push(state.activeFile);
        }
    }

    const tabsByPath = new Map(
        useWorkbenchStore.getState().tabs
            .map((tab) => [tab.path, tab] as const)
    );

    for (const filePath of dirtyPaths) {
        if (filePath === state.activeFile) continue;

        const tab = tabsByPath.get(filePath);
        if (!tab || typeof tab.textContent !== 'string') {
            result.skipped.push(filePath);
            continue;
        }

        try {
            await fsWriteTextFile(filePath, tab.textContent);
            useWorkbenchStore.getState().updateTabContent(tab.id, tab.textContent, { markDirty: false });
            getProjectState().clearFileDirty(filePath);
            result.saved.push(filePath);
        } catch (error) {
            console.error('Failed to save dirty file:', filePath, error);
            result.failed.push(filePath);
        }
    }

    return result;
}
