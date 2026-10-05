import type { GlobalSearchProjectData, GlobalSearchReplacementFile } from './contracts';

import { useProjectStore } from '../../store/storeBootstrap';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import { normalizePathForComparison } from '../../utils/pathComparison';
import { fsReadTextFile, fsWriteTextFile } from '../fs';
import { applyMacrosFile, applyScriptFile } from '../projectOpeners';
import { replacementModelText, replacementSourceContent } from './replacementSource';
import { resolveReplacementTarget } from './replacementTargetResolver';

export type ReplacementPlan = {
    consumed: boolean;
    files: PreparedFile[];
    isCurrent: () => boolean;
    isSessionCurrent: () => boolean;
};
export type ReplacementResult = {
    failed: { filePath: string; message: string }[];
    saved: string[];
    skipped: string[];
};
type PreparedFile = { expectedContent: string; modelText: string } & GlobalSearchReplacementFile;
let applying = false;

export async function applySearchReplacement(plan: ReplacementPlan): Promise<ReplacementResult> {
    const result: ReplacementResult = { failed: [], saved: [], skipped: [] };
    const skipRemaining = () => {
        result.skipped = plan.files.map(file => file.filePath).filter(path => !result.saved.includes(path) && !result.failed.some(file => file.filePath === path));
        return result;
    };
    if (applying || plan.consumed) return skipRemaining();
    plan.consumed = true;
    applying = true;
    try {
        if (!plan.isCurrent()) return skipRemaining();
        // Validate the whole confirmation before starting any writes.
        for (const file of plan.files) checkFile(plan, file);
        for (const file of plan.files) {
            if (!plan.isCurrent()) return skipRemaining();
            try {
                checkFile(plan, file);
                const originalTabs = tabsForPath(file.filePath).map(tab => ({ savedTextContent: tab.savedTextContent, tab, textContent: tab.textContent }));
                const closedTabs = new Set<string>();
                const unsubscribe = useWorkbenchStore.subscribe(state => {
                    for (const original of originalTabs) {
                        if (!state.tabs.some(tab => tab.id === original.tab.id && tab.path === original.tab.path)) closedTabs.add(original.tab.id);
                    }
                });
                try {
                    await fsWriteTextFile(file.filePath, file.content, { expectedContent: file.expectedContent });
                } finally {
                    unsubscribe();
                }
                result.saved.push(file.filePath);
                if (!plan.isSessionCurrent()) return skipRemaining();
                const clean = !isDirty(file.filePath) && replacementModelText(file, useProjectStore.getState()) === file.modelText;
                const refreshActive = closedTabs.size === 0 && tabsForPath(file.filePath).every(tab => originalTabs.some(original => original.tab === tab));
                for (const original of originalTabs) {
                    const current = useWorkbenchStore.getState().tabs.find(tab => tab.id === original.tab.id);
                    if (!current || closedTabs.has(current.id) || current.path !== original.tab.path || current.savedTextContent !== original.savedTextContent) continue;
                    if (current !== original.tab && !current.dirty) continue;
                    if (clean && current === original.tab && current.textContent === original.textContent) {
                        useWorkbenchStore.getState().updateTabContent(current.id, file.content, { markDirty: false });
                    } else {
                        useWorkbenchStore.getState().setTabSavedContent(current.id, file.content);
                    }
                }
                if (clean) reconcileModel(file, refreshActive);
            } catch (error) {
                result.failed.push({ filePath: file.filePath, message: error instanceof Error ? error.message : String(error) });
            }
        }
        return result;
    } catch (error) {
        result.failed.push({ filePath: '', message: error instanceof Error ? error.message : String(error) });
        return skipRemaining();
    } finally {
        applying = false;
    }
}

export async function prepareSearchReplacement(
    files: GlobalSearchReplacementFile[],
    projectData: GlobalSearchProjectData,
    isOwnerCurrent: () => boolean = () => true,
): Promise<ReplacementPlan> {
    const { projectGeneration, projectPath } = useProjectStore.getState();
    const manifestText = JSON.stringify(projectData.manifest);
    const baselines = files.map(file => ({ file, modelText: replacementModelText(file, projectData) }));
    const isSessionCurrent = () => useProjectStore.getState().projectGeneration === projectGeneration
        && useProjectStore.getState().projectPath === projectPath;
    const isCurrent = () => isOwnerCurrent() && isSessionCurrent()
        && useProjectStore.getState().manifest === projectData.manifest
        && JSON.stringify(useProjectStore.getState().manifest) === manifestText;
    const check = () => {
        if (!isCurrent()) throw new Error('Project changed. Search again before replacing.');
        for (const { file, modelText } of baselines) {
            assertClean(file.filePath);
            if (modelText === undefined || replacementModelText(file, useProjectStore.getState()) !== modelText) {
                throw new Error('Search content changed. Search again before replacing.');
            }
        }
    };
    check();
    const prepared: PreparedFile[] = [];
    for (const { file, modelText } of baselines) {
        const expectedContent = await fsReadTextFile(file.filePath);
        check();
        if (modelText === undefined) throw new Error('Search target changed. Search again before replacing.');
        const tabs = tabsForPath(file.filePath);
        if (tabs.some(tab => tab.savedTextContent !== undefined && tab.savedTextContent !== expectedContent)) {
            throw new Error(`Source changed: ${file.filePath}. Reopen the file and search again.`);
        }
        prepared.push({ ...file, content: replacementSourceContent(file, expectedContent, modelText), expectedContent, modelText });
    }
    return { consumed: false, files: prepared, isCurrent, isSessionCurrent };
}

export function replacementStatus(result: ReplacementResult): string {
    const summary = `Replaced content in ${result.saved.length} file(s).`;
    const errors = result.failed.map(file => `${file.filePath ? `${file.filePath}: ` : ''}${file.message}`).join('\n');
    return `${summary}${errors ? `\nFailed: ${errors}` : ''}${result.skipped.length > 0 ? `\nSkipped ${result.skipped.length} file(s). Search again to retry.` : ''}`;
}

function assertClean(path: string): void {
    if (isDirty(path)) throw new Error(`Save or discard unsaved changes before replacing: ${path}`);
}

function checkFile(plan: ReplacementPlan, file: PreparedFile): void {
    if (!plan.isCurrent()) throw new Error('Project changed. Search again before replacing.');
    assertClean(file.filePath);
    if (replacementModelText(file, useProjectStore.getState()) !== file.modelText) {
        throw new Error(`Search content changed: ${file.filePath}. Search again before replacing.`);
    }
}

function isDirty(path: string): boolean {
    return [...useProjectStore.getState().dirtyFiles].some(dirty => normalizePathForComparison(dirty) === normalizePathForComparison(path))
        || tabsForPath(path).some(tab => tab.dirty);
}

function reconcileModel(file: PreparedFile, refreshActive: boolean): void {
    const project = useProjectStore.getState();
    const target = resolveReplacementTarget(file.filePath, project.scenes, project);
    const data = JSON.parse(file.content) as unknown;
    switch (target?.kind) {
    case 'character': {
        useProjectStore.setState({ characters: data as GlobalSearchProjectData['characters'] });
        break;
    }
    case 'item': {
        useProjectStore.setState({ items: data as GlobalSearchProjectData['items'] });
        break;
    }
    case 'macro': {
        useProjectStore.setState({ macros: Object.fromEntries(Object.entries(data as GlobalSearchProjectData['macros']).filter(([name]) => !name.startsWith('$'))) });
        break;
    }
    case 'scene': {
        const commands = Array.isArray(data) ? data : (data as { commands: GlobalSearchProjectData['scenes'][string] }).commands;
        useProjectStore.setState({ scenes: { ...project.scenes, [target.sceneName]: commands } });
        break;
    }
    default: { return; }
    }
    if (!refreshActive || project.activeFile !== file.filePath) return;
    if (file.kind === 'scene') applyScriptFile(file.filePath, data);
    if (file.kind === 'macro') {
        const macroName = project.activeMacroName;
        if (macroName && !project.editingAllMacrosFile) {
            project.setActiveFile(file.filePath, useProjectStore.getState().macros[macroName] ?? []);
        } else applyMacrosFile(file.filePath, data as Record<string, unknown>);
    }
}

function tabsForPath(path: string) {
    return useWorkbenchStore.getState().tabs.filter(tab => normalizePathForComparison(tab.path) === normalizePathForComparison(path));
}
