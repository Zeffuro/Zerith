import { executeConsoleMessageAction } from '../store/actions/consoleMessageActions';
import { executeProjectTreeRefreshAction, getCurrentProjectPath } from '../store/actions/projectTreeActions';
import { useProjectStore } from '../store/storeBootstrap';
import { useReferenceStore } from '../store/useReferenceStore';
import { useWorkbenchStore } from '../store/useWorkbenchStore';
import { sanitizeFileName } from '../utils/sanitizeFileName';
import { isRecord } from '../utils/typeGuards';
import {
    loadAssetLibraryMetadata,
    moveAssetLibraryMetadataScope,
    saveAssetLibraryMetadata,
} from './assetLibraryMetadata';
import {
    applyAssetReferenceRewritePlan,
    type AssetReferenceReplacement,
    type AssetReferenceRewriteFile,
    type AssetReferenceRewritePlan,
    prepareAssetReferenceBatchRewritePlan,
} from './assetReferenceRewrite';
import { FileWriteBatchError } from './fileWriteBatch';
import {
    fsDirname,
    fsJoin,
    fsMkdir,
    fsOpenPath,
    fsPickDirectory,
    fsReadBinaryFile,
    fsReadDirectory,
    fsRemove,
    fsRename,
    fsWriteBinaryFile,
    fsWriteTextFile,
} from './fs';
import { getDefaultContentForNewFile } from './newFileTemplates';
import { applyMacrosFile, applyScriptFile } from './projectOpeners';
import { refreshReferenceScannerState } from './referenceScanner';
import { toProjectAssetUrl } from './referenceScanner/assets';

type ProjectAssetPathChange = {
    newAssetUrl: string;
    newPath: string;
    oldAssetUrl: string;
    oldPath: string;
    projectPath: string;
};

export async function createFileInDirectory(directoryPath: string, name: string, initialContent?: string) {
    try {
        const sanitizedName = sanitizeFileName(name);
        if (!sanitizedName) {
            executeConsoleMessageAction('editor', 'warn', 'Create file aborted: invalid file name.');
            return;
        }

        if (sanitizedName !== name) {
            executeConsoleMessageAction('editor', 'warn', `File name sanitized: '${name}' -> '${sanitizedName}'`);
        }

        if (await hasSiblingWithName(directoryPath, sanitizedName)) {
            executeConsoleMessageAction('editor', 'warn', `Create file aborted: '${sanitizedName}' already exists.`);
            return;
        }

        const full = await fsJoin(directoryPath, sanitizedName);
        await fsWriteTextFile(full, initialContent ?? getDefaultContentForNewFile(sanitizedName));
        await refreshProjectTree();
        return full;
    } catch (error) {
        console.error('Create file failed:', error);
        executeConsoleMessageAction('editor', 'error', 'Create file failed:', String(error));
        return;
    }
}

export async function createFolderInDirectory(directoryPath: string, name: string) {
    try {
        const sanitizedName = sanitizeFileName(name);
        if (!sanitizedName) {
            executeConsoleMessageAction('editor', 'warn', 'Create folder aborted: invalid folder name.');
            return;
        }

        if (sanitizedName !== name) {
            executeConsoleMessageAction('editor', 'warn', `Folder name sanitized: '${name}' -> '${sanitizedName}'`);
        }

        if (await hasSiblingWithName(directoryPath, sanitizedName)) {
            executeConsoleMessageAction('editor', 'warn', `Create folder aborted: '${sanitizedName}' already exists.`);
            return;
        }

        const full = await fsJoin(directoryPath, sanitizedName);
        await fsMkdir(full, true);
        await refreshProjectTree();
        return full;
    } catch (error) {
        console.error('Create folder failed:', error);
        executeConsoleMessageAction('editor', 'error', 'Create folder failed:', String(error));
        return;
    }
}

export async function deletePath(path: string) {
    try {
        const referencedAssetUrls = getReferencedAssetUrlsForDelete(path);
        if (referencedAssetUrls.length > 0) {
            executeConsoleMessageAction(
                'editor',
                'warn',
                'Delete aborted: remove asset references before deleting:',
                referencedAssetUrls.join(', '),
            );
            return;
        }

        const isProjectAssetDelete = isProjectAssetPath(path);
        await fsRemove(path, true);
        await refreshProjectTree();
        if (isProjectAssetDelete) {
            await refreshReferenceScannerState();
        }
    } catch (error) {
        console.error('Delete failed:', error);
        executeConsoleMessageAction('editor', 'error', 'Delete failed:', String(error));
    }
}

export async function deletePaths(paths: string[]): Promise<number> {
    const uniquePaths = [...new Set(paths.filter(Boolean))];
    if (uniquePaths.length === 0) return 0;

    let deletedCount = 0;
    let deletedProjectAsset = false;

    for (const path of uniquePaths) {
        try {
            const referencedAssetUrls = getReferencedAssetUrlsForDelete(path);
            if (referencedAssetUrls.length > 0) {
                executeConsoleMessageAction(
                    'editor',
                    'warn',
                    `Delete skipped for ${path}: remove asset references before deleting:`,
                    referencedAssetUrls.join(', '),
                );
                continue;
            }

            deletedProjectAsset = deletedProjectAsset || isProjectAssetPath(path);
            await fsRemove(path, true);
            deletedCount += 1;
        } catch (error) {
            console.error('Delete failed:', error);
            executeConsoleMessageAction('editor', 'error', `Delete failed for ${path}:`, String(error));
        }
    }

    await refreshProjectTree();
    if (deletedProjectAsset) {
        await refreshReferenceScannerState();
    }
    return deletedCount;
}

export async function duplicatePath(path: string) {
    try {
        const parent = await fsDirname(path);
        const sourceName = basename(path);
        const siblingEntries = await fsReadDirectory(parent);
        const siblingNames = new Set(siblingEntries.map((entry) => entry.name));

        const duplicateName = makeDuplicateName(sourceName, siblingNames);
        const targetPath = await fsJoin(parent, duplicateName);

        const bytes = await fsReadBinaryFile(path);
        await fsWriteBinaryFile(targetPath, bytes);
        await refreshProjectTree();
        return targetPath;
    } catch (error) {
        console.error('Duplicate failed:', error);
        executeConsoleMessageAction('editor', 'error', 'Duplicate failed:', String(error));
        return;
    }
}

export async function moveAssetDirectoryPathToDirectory(oldPath: string, targetDirectoryPath: string) {
    const { projectGeneration, projectPath } = useProjectStore.getState();
    const owner = { projectGeneration, projectPath };
    try {
        const name = basename(oldPath);
        if (!name) {
            executeConsoleMessageAction('editor', 'warn', 'Move aborted: invalid asset folder path.');
            return;
        }

        const newPath = await fsJoin(targetDirectoryPath, name);
        if (normalizePath(oldPath) === normalizePath(newPath)) {
            return oldPath;
        }

        if (isSameOrNestedPath(targetDirectoryPath, oldPath)) {
            executeConsoleMessageAction('editor', 'warn', 'Move aborted: target folder cannot be inside the moved asset folder.');
            return;
        }

        const assetPathChange = resolveProjectAssetPathChange(oldPath, newPath);
        if (!assetPathChange) {
            executeConsoleMessageAction('editor', 'warn', 'Move aborted: asset folders can only move within the current project assets folder.');
            return;
        }

        if (await hasSiblingWithName(targetDirectoryPath, name)) {
            executeConsoleMessageAction('editor', 'warn', `Move aborted: '${name}' already exists in the target folder.`);
            return;
        }

        const assetRewritePlan = await prepareAssetDirectoryReferenceRewrite(assetPathChange);
        if (assetRewritePlan?.blockedDirtyFiles.length) {
            executeConsoleMessageAction(
                'editor',
                'warn',
                'Move aborted: save referenced files before updating asset references:',
                assetRewritePlan.blockedDirtyFiles.join(', '),
            );
            return;
        }

        return await applyPathChange(oldPath, newPath, assetRewritePlan, assetPathChange, owner);
    } catch (error) {
        console.error('Move failed:', error);
        executeConsoleMessageAction('editor', 'error', 'Move failed:', String(error));
        return;
    }
}

export async function moveAssetDirectoryPathWithPicker(oldPath: string) {
    try {
        const targetDirectoryPath = await fsPickDirectory('Move asset folder to folder...');
        if (!targetDirectoryPath) {
            return;
        }

        return await moveAssetDirectoryPathToDirectory(oldPath, targetDirectoryPath);
    } catch (error) {
        console.error('Move failed:', error);
        executeConsoleMessageAction('editor', 'error', 'Move failed:', String(error));
        return;
    }
}

export async function moveAssetPathToDirectory(oldPath: string, targetDirectoryPath: string) {
    const { projectGeneration, projectPath } = useProjectStore.getState();
    const owner = { projectGeneration, projectPath };
    try {
        const name = basename(oldPath);
        if (!name) {
            executeConsoleMessageAction('editor', 'warn', 'Move aborted: invalid asset path.');
            return;
        }

        const newPath = await fsJoin(targetDirectoryPath, name);
        if (normalizePath(oldPath) === normalizePath(newPath)) {
            return oldPath;
        }

        const assetPathChange = resolveProjectAssetPathChange(oldPath, newPath);
        if (!assetPathChange) {
            executeConsoleMessageAction('editor', 'warn', 'Move aborted: assets can only move within the current project assets folder.');
            return;
        }

        if (await hasSiblingWithName(targetDirectoryPath, name)) {
            executeConsoleMessageAction('editor', 'warn', `Move aborted: '${name}' already exists in the target folder.`);
            return;
        }

        const assetRewritePlan = await prepareAssetDirectoryReferenceRewrite(assetPathChange);
        if (assetRewritePlan?.blockedDirtyFiles.length) {
            executeConsoleMessageAction(
                'editor',
                'warn',
                'Move aborted: save referenced files before updating asset references:',
                assetRewritePlan.blockedDirtyFiles.join(', '),
            );
            return;
        }

        return await applyPathChange(oldPath, newPath, assetRewritePlan, assetPathChange, owner);
    } catch (error) {
        console.error('Move failed:', error);
        executeConsoleMessageAction('editor', 'error', 'Move failed:', String(error));
        return;
    }
}

export async function moveAssetPathWithPicker(oldPath: string) {
    try {
        const targetDirectoryPath = await fsPickDirectory('Move asset to folder...');
        if (!targetDirectoryPath) {
            return;
        }

        return await moveAssetPathToDirectory(oldPath, targetDirectoryPath);
    } catch (error) {
        console.error('Move failed:', error);
        executeConsoleMessageAction('editor', 'error', 'Move failed:', String(error));
        return;
    }
}

export async function refreshProjectTree() {
    const { projectGeneration } = useProjectStore.getState();
    const projectPath = getCurrentProjectPath();
    if (!projectPath) return;

    const entries = await fsReadDirectory(projectPath);
    const current = useProjectStore.getState();
    if (current.projectPath !== projectPath || current.projectGeneration !== projectGeneration) return;
    executeProjectTreeRefreshAction(projectPath, entries);
}

export async function renamePath(oldPath: string, nextName: string) {
    const { projectGeneration, projectPath } = useProjectStore.getState();
    const owner = { projectGeneration, projectPath };
    try {
        const parent = await fsDirname(oldPath);
        const sanitizedName = sanitizeFileName(nextName);
        if (!sanitizedName) {
            executeConsoleMessageAction('editor', 'warn', 'Rename aborted: invalid file name.');
            return;
        }

        if (sanitizedName !== nextName) {
            executeConsoleMessageAction('editor', 'warn', `Rename sanitized: '${nextName}' -> '${sanitizedName}'`);
        }

        const oldName = basename(oldPath);
        const isCaseOnlyRename = oldName.toLowerCase() === sanitizedName.toLowerCase();
        if (!isCaseOnlyRename && await hasSiblingWithName(parent, sanitizedName)) {
            executeConsoleMessageAction('editor', 'warn', `Rename aborted: '${sanitizedName}' already exists.`);
            return;
        }

        const newPath = await fsJoin(parent, sanitizedName);
        const assetPathChange = resolveProjectAssetPathChange(oldPath, newPath);
        const assetRewritePlan = await prepareAssetDirectoryReferenceRewrite(assetPathChange);
        if (assetRewritePlan?.blockedDirtyFiles.length) {
            executeConsoleMessageAction(
                'editor',
                'warn',
                'Rename aborted: save referenced files before updating asset references:',
                assetRewritePlan.blockedDirtyFiles.join(', '),
            );
            return;
        }

        await applyPathChange(oldPath, newPath, assetRewritePlan, assetPathChange, owner);
    } catch (error) {
        console.error('Rename failed:', error);
        executeConsoleMessageAction('editor', 'error', 'Rename failed:', String(error));
    }
}

export async function revealPathInSystem(path: string) {
    try {
        await fsOpenPath(path);
    } catch (error) {
        console.error('Reveal failed:', error);
        executeConsoleMessageAction('editor', 'error', 'Reveal failed:', String(error));
    }
}

async function applyAssetLibraryMetadataMove(assetPathChange: ProjectAssetPathChange): Promise<void> {
    try {
        const metadata = await loadAssetLibraryMetadata(assetPathChange.projectPath);
        const nextMetadata = moveAssetLibraryMetadataScope(
            metadata,
            assetPathChange.oldAssetUrl,
            assetPathChange.newAssetUrl,
        );

        if (JSON.stringify(metadata.assets) === JSON.stringify(nextMetadata.assets)) {
            return;
        }

        await saveAssetLibraryMetadata(assetPathChange.projectPath, nextMetadata);
    } catch (error) {
        console.warn('Asset library metadata move update failed:', error);
        executeConsoleMessageAction('editor', 'warn', 'Asset library metadata was not updated after move:', String(error));
    }
}

async function applyPathChange(
    oldPath: string,
    newPath: string,
    plan: AssetReferenceRewritePlan | undefined,
    assetPathChange: ProjectAssetPathChange | undefined,
    owner: Pick<ReturnType<typeof useProjectStore.getState>, 'projectGeneration' | 'projectPath'>,
): Promise<string | undefined> {
    const ownsProject = () => {
        const current = useProjectStore.getState();
        return current.projectPath === owner.projectPath && current.projectGeneration === owner.projectGeneration;
    };
    if (!ownsProject()) return;
    const dirtyFiles = useProjectStore.getState().dirtyFiles;
    if (plan?.files.some((file) => [...dirtyFiles].some((path) => normalizePath(path) === normalizePath(replacePathPrefix(file.filePath, newPath, oldPath))))) {
        throw new Error('Save referenced files before updating asset references.');
    }
    try {
        await fsRename(oldPath, newPath);
    } catch (error) {
        if (ownsProject()) {
            try {
                await refreshProjectTree();
            } catch (refreshError) {
                executeConsoleMessageAction('editor', 'error', 'Project refresh failed after an incomplete move:', String(refreshError));
            }
        }
        throw error;
    }
    if (ownsProject()) {
        remapWorkbenchTabsForRename(oldPath, newPath);
        useProjectStore.setState((state) => ({
            activeFile: state.activeFile ? replacePathPrefix(state.activeFile, oldPath, newPath) : state.activeFile,
            dirtyFiles: new Set([...state.dirtyFiles].map((path) => replacePathPrefix(path, oldPath, newPath))),
            expandedPaths: remapExpandedPathsForRename(state.expandedPaths, oldPath, newPath),
        }));
    }

    let failed = false;
    try {
        if (assetPathChange) await applyAssetLibraryMetadataMove(assetPathChange);
        if (plan?.files.length) {
            try {
                await applyAssetReferenceRewritePlan(plan);
                if (ownsProject()) syncRewrittenWorkbenchTabs(plan.files);
            } catch (error) {
                if (error instanceof FileWriteBatchError && ownsProject()) {
                    const committed = new Set(error.result.committed);
                    syncRewrittenWorkbenchTabs(plan.files.filter((file) => committed.has(file.filePath)));
                }
                throw error;
            }
            executeConsoleMessageAction('editor', 'info', `Updated ${plan.replacementCount} asset reference${plan.replacementCount === 1 ? '' : 's'} after move or rename.`);
        }
    } catch (error) {
        failed = true;
        executeConsoleMessageAction('editor', 'error', `Path moved to ${newPath}, but reference updates are incomplete:`, String(error));
    } finally {
        const refreshes = [refreshProjectTree, () => useProjectStore.getState().loadManifest(), refreshReferenceScannerState];
        for (const refresh of refreshes) {
            if (!ownsProject()) break;
            try {
                await refresh();
            } catch (error) {
                failed = true;
                executeConsoleMessageAction('editor', 'error', `Path moved to ${newPath}, but project refresh failed:`, String(error));
            }
        }
    }
    return failed ? undefined : newPath;
}

function basename(path: string) {
    return path.split(/[\\/]/).pop() || path;
}

function getAssetDirectoryReferenceReplacements(
    assetPathChange: ProjectAssetPathChange,
): AssetReferenceReplacement[] {
    const referencesByAssetUrl = useReferenceStore.getState().result.assetFiles;
    const oldDirectoryUrl = trimTrailingSlash(assetPathChange.oldAssetUrl);
    const newDirectoryUrl = trimTrailingSlash(assetPathChange.newAssetUrl);
    const replacements: AssetReferenceReplacement[] = [];

    for (const [oldAssetUrl, references] of Object.entries(referencesByAssetUrl)) {
        const movedAsset = oldAssetUrl === oldDirectoryUrl || oldAssetUrl.startsWith(`${oldDirectoryUrl}/`);
        const affectedReferences = movedAsset ? references : references.filter((reference) => replacePathPrefix(reference.filePath, assetPathChange.oldPath, assetPathChange.newPath) !== reference.filePath);
        if (affectedReferences.length === 0) continue;

        replacements.push({
            newAssetUrl: movedAsset ? `${newDirectoryUrl}${oldAssetUrl.slice(oldDirectoryUrl.length)}` : oldAssetUrl,
            oldAssetUrl,
            references: affectedReferences,
        });
    }

    return replacements.toSorted((left, right) => left.oldAssetUrl.localeCompare(right.oldAssetUrl));
}

function getReferencedAssetUrlsForDelete(path: string): string[] {
    const projectPath = useProjectStore.getState().projectPath;
    const assetUrl = toProjectAssetUrl(path, projectPath);
    if (!assetUrl) return [];

    const normalizedAssetUrl = trimTrailingSlash(assetUrl);
    const childPrefix = `${normalizedAssetUrl}/`;
    const referencesByAssetUrl = useReferenceStore.getState().result.assetFiles;

    return Object.entries(referencesByAssetUrl)
        .filter(([candidateUrl, references]) => (
            references.length > 0
            && (candidateUrl === normalizedAssetUrl || candidateUrl.startsWith(childPrefix))
        ))
        .map(([candidateUrl]) => candidateUrl)
        .toSorted((left, right) => left.localeCompare(right));
}

async function hasSiblingWithName(directoryPath: string, candidateName: string): Promise<boolean> {
    const siblingEntries = await fsReadDirectory(directoryPath);
    const candidateLower = candidateName.toLowerCase();
    return siblingEntries.some((entry) => entry.name.toLowerCase() === candidateLower);
}

function isProjectAssetPath(path: string): boolean {
    return Boolean(toProjectAssetUrl(path, useProjectStore.getState().projectPath));
}

function isSameOrNestedPath(path: string, directoryPath: string): boolean {
    const normalizedPath = trimTrailingSlash(normalizePath(path));
    const normalizedDirectory = trimTrailingSlash(normalizePath(directoryPath));
    return normalizedPath === normalizedDirectory || normalizedPath.startsWith(`${normalizedDirectory}/`);
}

function makeDuplicateName(sourceName: string, existing: Set<string>): string {
    const extensionIndex = sourceName.lastIndexOf('.');
    const hasExtension = extensionIndex > 0;
    const root = hasExtension ? sourceName.slice(0, extensionIndex) : sourceName;
    const extension = hasExtension ? sourceName.slice(extensionIndex) : '';

    const first = `${root} copy${extension}`;
    if (!existing.has(first)) return first;

    let n = 2;
    while (existing.has(`${root} copy ${n}${extension}`)) {
        n += 1;
    }
    return `${root} copy ${n}${extension}`;
}

function normalizePath(path: string): string {
    return path.replaceAll('\\', '/').replaceAll(/\/+/gu, '/').toLowerCase();
}

async function prepareAssetDirectoryReferenceRewrite(
    assetPathChange: ProjectAssetPathChange | undefined,
): Promise<AssetReferenceRewritePlan | undefined> {
    if (!assetPathChange) return;
    const replacements = getAssetDirectoryReferenceReplacements(assetPathChange);
    if (replacements.length === 0) {
        return;
    }

    const projectState = useProjectStore.getState();
    return prepareAssetReferenceBatchRewritePlan({
        destinationForFile: (filePath) => replacePathPrefix(filePath, assetPathChange.oldPath, assetPathChange.newPath),
        dirtyFiles: projectState.dirtyFiles,
        projectPath: assetPathChange.projectPath,
        replacements,
    });
}

function remapExpandedPathsForRename(expandedPaths: string[], oldPath: string, newPath: string): string[] {
    const remapped = expandedPaths.map((path) => replacePathPrefix(path, oldPath, newPath));
    return [...new Set(remapped)];
}

function remapWorkbenchTabsForRename(oldPath: string, newPath: string): void {
    useWorkbenchStore.getState().renameTabPath(newPath, oldPath);

    const tabs = [...useWorkbenchStore.getState().tabs];
    for (const tab of tabs) {
        if (tab.path === oldPath) {
            continue;
        }

        const nextPath = replacePathPrefix(tab.path, oldPath, newPath);
        if (nextPath !== tab.path) {
            useWorkbenchStore.getState().renameTabPath(nextPath, tab.path);
        }
    }
}

function replacePathPrefix(path: string, oldPath: string, newPath: string): string {
    if (path === oldPath) {
        return newPath;
    }

    if (path.startsWith(`${oldPath}/`) || path.startsWith(`${oldPath}\\`)) {
        return `${newPath}${path.slice(oldPath.length)}`;
    }

    return path;
}

function resolveProjectAssetPathChange(oldPath: string, newPath: string): ProjectAssetPathChange | undefined {
    const projectPath = useProjectStore.getState().projectPath;
    const oldAssetUrl = toProjectAssetUrl(oldPath, projectPath);
    const newAssetUrl = toProjectAssetUrl(newPath, projectPath);
    if (!projectPath || !oldAssetUrl || !newAssetUrl || oldAssetUrl === newAssetUrl) {
        return;
    }

    return {
        newAssetUrl,
        newPath,
        oldAssetUrl,
        oldPath,
        projectPath,
    };
}

function syncRewrittenWorkbenchTabs(files: readonly AssetReferenceRewriteFile[]): void {
    const workbench = useWorkbenchStore.getState();
    for (const file of files) {
        const tab = workbench.tabs.find((candidate) => normalizePath(candidate.path) === normalizePath(file.filePath));
        if (!tab) continue;

        const dirtyFiles = useProjectStore.getState().dirtyFiles;
        if (tab.dirty || [...dirtyFiles].some((path) => normalizePath(path) === normalizePath(file.filePath))) {
            useWorkbenchStore.getState().setTabSavedContent(tab.id, file.content);
        } else {
            useWorkbenchStore.getState().updateTabContent(tab.id, file.content, { markDirty: false });
            const activeFile = useProjectStore.getState().activeFile;
            if (!activeFile || normalizePath(activeFile) !== normalizePath(file.filePath)) continue;
            const parsed: unknown = JSON.parse(file.content);
            if (tab.kind === 'script') applyScriptFile(file.filePath, parsed);
            if (tab.kind === 'macros' && isRecord(parsed)) applyMacrosFile(file.filePath, parsed);
        }
    }
}

function trimTrailingSlash(path: string): string {
    return path.replaceAll(/\/+$/gu, '');
}


