import type { ProjectGet, SaveAllResult } from '../store/project/types';

import { useWorkbenchStore } from '../store/useWorkbenchStore';
import { canonicalPathForComparison } from '../utils/pathComparison';
import { fsWriteTextFile } from './fs';
import { validateLocalizationFileSnapshot } from './localizationFileSnapshot';

export async function saveAllFiles(getProjectState: ProjectGet): Promise<SaveAllResult> {
    const state = getProjectState();
    const { activeFile, projectGeneration, projectPath } = state;
    const dirtyPaths = [...state.dirtyFiles];
    const result: SaveAllResult = { failed: [], saved: [], skipped: [] };
    const isCurrent = () => getProjectState().projectGeneration === projectGeneration
        && getProjectState().projectPath === projectPath;
    const stopStaleSave = () => {
        result.skipped.push(...dirtyPaths.filter(path => !result.saved.includes(path) && !result.failed.includes(path) && !result.skipped.includes(path)));
        return result;
    };

    if (dirtyPaths.length === 0) {
        return result;
    }

    if (activeFile && state.dirtyFiles.has(activeFile)) {
        try {
            await state.saveActiveFileFromCurrentScript();
        } catch (error) {
            if (!isCurrent()) return stopStaleSave();
            console.error('Failed to save active file:', error);
            result.failed.push(activeFile);
        }
        if (!isCurrent()) return stopStaleSave();
        if (getProjectState().dirtyFiles.has(activeFile)) {
            if (!result.failed.includes(activeFile)) result.failed.push(activeFile);
        } else if (!result.failed.includes(activeFile)) {
            result.saved.push(activeFile);
        }
    }

    for (const filePath of dirtyPaths) {
        if (!isCurrent()) return stopStaleSave();
        if (filePath === activeFile) continue;
        if (!getProjectState().dirtyFiles.has(filePath)) continue;

        const tab = useWorkbenchStore.getState().tabs.find(entry => entry.path === filePath);
        if (!tab || typeof tab.textContent !== 'string') {
            result.skipped.push(filePath);
            continue;
        }

        const { id: tabId, savedTextContent, textContent } = tab;
        let removed = false;
        const unsubscribe = useWorkbenchStore.subscribe(state => {
            if (!state.tabs.some(entry => entry.id === tabId && entry.path === filePath)) removed = true;
        });
        try {
            validateLocalizationFileSnapshot(filePath, textContent, getProjectState());
            await fsWriteTextFile(filePath, textContent, savedTextContent === undefined ? undefined : { expectedContent: savedTextContent }, () => isCurrent() && !removed);
            if (!isCurrent()) return stopStaleSave();
            if (removed) { result.skipped.push(filePath); continue; }
            const current = useWorkbenchStore.getState().tabs.find(entry => entry.id === tabId);
            if (current !== tab || current.path !== filePath || current.textContent !== textContent || current.savedTextContent !== savedTextContent) {
                if (current?.path === filePath && current.savedTextContent === savedTextContent) {
                    useWorkbenchStore.getState().setTabSavedContent(tabId, textContent);
                }
                result.skipped.push(filePath);
                continue;
            }
            useWorkbenchStore.getState().updateTabContent(tabId, textContent, { markDirty: false });
            getProjectState().clearFileDirty(filePath);
            result.saved.push(filePath);
        } catch (error) {
            if (!isCurrent()) return stopStaleSave();
            if (removed) { result.skipped.push(filePath); continue; }
            console.error('Failed to save dirty file:', filePath, error);
            result.failed.push(filePath);
        } finally { unsubscribe(); }
    }

    const modelPaths = new Set([
        `${projectPath?.replaceAll(/[\\/]+$/gu, '')}/game.json`,
        ...Object.values(state.localePaths ?? {}).filter((path): path is string => path !== undefined),
    ].map(path => canonicalPathForComparison(path)));
    if (isCurrent() && result.saved.some(path => modelPaths.has(canonicalPathForComparison(path)))) {
        await getProjectState().loadManifest();
    }
    return result;
}
