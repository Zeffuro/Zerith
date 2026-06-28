import { executeConsoleMessageAction } from '../store/actions/consoleMessageActions';
import { executeProjectTreeRefreshAction, getCurrentProjectPath } from '../store/actions/projectTreeActions';
import { useProjectStore } from '../store/storeBootstrap';
import { useReferenceStore } from '../store/useReferenceStore';
import { useWorkbenchStore } from '../store/useWorkbenchStore';
import { sanitizeFileName } from '../utils/sanitizeFileName';
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
    prepareAssetReferenceRewritePlan,
} from './assetReferenceRewrite';
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
import { refreshReferenceScannerState } from './referenceScanner';
import { toProjectAssetUrl } from './referenceScanner/assets';

type ProjectAssetPathChange = {
    newAssetUrl: string;
    oldAssetUrl: string;
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

        await fsRename(oldPath, newPath);
        await applyAssetLibraryMetadataMove(assetPathChange);
        remapWorkbenchTabsForRename(oldPath, newPath);
        useProjectStore.setState((state) => ({
            activeFile: state.activeFile ? replacePathPrefix(state.activeFile, oldPath, newPath) : state.activeFile,
            expandedPaths: remapExpandedPathsForRename(state.expandedPaths, oldPath, newPath),
        }));

        if (assetRewritePlan && assetRewritePlan.replacementCount > 0) {
            await applyAssetReferenceRewritePlan(assetRewritePlan);
            syncRewrittenWorkbenchTabs(assetRewritePlan.files);
            await useProjectStore.getState().loadManifest();
            executeConsoleMessageAction(
                'editor',
                'info',
                `Updated ${assetRewritePlan.replacementCount} asset reference${assetRewritePlan.replacementCount === 1 ? '' : 's'} after folder move.`,
            );
        }

        await refreshProjectTree();
        await refreshReferenceScannerState();
        return newPath;
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

        const assetRewritePlan = await prepareAssetPathReferenceRewrite(assetPathChange);
        if (assetRewritePlan?.blockedDirtyFiles.length) {
            executeConsoleMessageAction(
                'editor',
                'warn',
                'Move aborted: save referenced files before updating asset references:',
                assetRewritePlan.blockedDirtyFiles.join(', '),
            );
            return;
        }

        await fsRename(oldPath, newPath);
        await applyAssetLibraryMetadataMove(assetPathChange);
        remapWorkbenchTabsForRename(oldPath, newPath);
        useProjectStore.setState((state) => ({
            activeFile: state.activeFile ? replacePathPrefix(state.activeFile, oldPath, newPath) : state.activeFile,
            expandedPaths: remapExpandedPathsForRename(state.expandedPaths, oldPath, newPath),
        }));

        if (assetRewritePlan && assetRewritePlan.replacementCount > 0) {
            await applyAssetReferenceRewritePlan(assetRewritePlan);
            syncRewrittenWorkbenchTabs(assetRewritePlan.files);
            await useProjectStore.getState().loadManifest();
            executeConsoleMessageAction(
                'editor',
                'info',
                `Updated ${assetRewritePlan.replacementCount} asset reference${assetRewritePlan.replacementCount === 1 ? '' : 's'} after move.`,
            );
        }

        await refreshProjectTree();
        await refreshReferenceScannerState();
        return newPath;
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
    const projectPath = getCurrentProjectPath();
    if (!projectPath) return;

    const entries = await fsReadDirectory(projectPath);
    executeProjectTreeRefreshAction(projectPath, entries);
}

export async function renamePath(oldPath: string, nextName: string) {
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
        const assetRewritePlan = await prepareAssetPathReferenceRewrite(assetPathChange);
        if (assetRewritePlan?.blockedDirtyFiles.length) {
            executeConsoleMessageAction(
                'editor',
                'warn',
                'Rename aborted: save referenced files before updating asset references:',
                assetRewritePlan.blockedDirtyFiles.join(', '),
            );
            return;
        }

        await fsRename(oldPath, newPath);
        useWorkbenchStore.getState().renameTabPath(newPath, oldPath);
        useProjectStore.setState((state) => {
            const remappedExpandedPaths = remapExpandedPathsForRename(state.expandedPaths, oldPath, newPath);

            return {
                activeFile: state.activeFile === oldPath ? newPath : state.activeFile,
                expandedPaths: remappedExpandedPaths,
            };
        });

        if (assetRewritePlan && assetRewritePlan.replacementCount > 0) {
            await applyAssetReferenceRewritePlan(assetRewritePlan);
            syncRewrittenWorkbenchTabs(assetRewritePlan.files);
            await useProjectStore.getState().loadManifest();
            executeConsoleMessageAction(
                'editor',
                'info',
                `Updated ${assetRewritePlan.replacementCount} asset reference${assetRewritePlan.replacementCount === 1 ? '' : 's'} after rename.`,
            );
        }

        await refreshProjectTree();
        if (assetPathChange) {
            await refreshReferenceScannerState();
        }
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
        if (!oldAssetUrl.startsWith(`${oldDirectoryUrl}/`) || references.length === 0) {
            continue;
        }

        replacements.push({
            newAssetUrl: `${newDirectoryUrl}${oldAssetUrl.slice(oldDirectoryUrl.length)}`,
            oldAssetUrl,
            references,
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
    assetPathChange: ProjectAssetPathChange,
): Promise<AssetReferenceRewritePlan | undefined> {
    const replacements = getAssetDirectoryReferenceReplacements(assetPathChange);
    if (replacements.length === 0) {
        return;
    }

    const projectState = useProjectStore.getState();
    return prepareAssetReferenceBatchRewritePlan({
        dirtyFiles: projectState.dirtyFiles,
        projectPath: assetPathChange.projectPath,
        replacements,
    });
}

async function prepareAssetPathReferenceRewrite(
    assetPathChange: ProjectAssetPathChange | undefined,
): Promise<AssetReferenceRewritePlan | undefined> {
    if (!assetPathChange) {
        return;
    }

    const references = useReferenceStore.getState().result.assetFiles[assetPathChange.oldAssetUrl] ?? [];
    if (references.length === 0) {
        return;
    }

    const projectState = useProjectStore.getState();
    return prepareAssetReferenceRewritePlan({
        dirtyFiles: projectState.dirtyFiles,
        newAssetUrl: assetPathChange.newAssetUrl,
        oldAssetUrl: assetPathChange.oldAssetUrl,
        projectPath: assetPathChange.projectPath,
        references,
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
        oldAssetUrl,
        projectPath,
    };
}

function syncRewrittenWorkbenchTabs(files: readonly AssetReferenceRewriteFile[]): void {
    const workbench = useWorkbenchStore.getState();
    for (const file of files) {
        const tab = workbench.tabs.find((candidate) => normalizePath(candidate.path) === normalizePath(file.filePath));
        if (tab?.textContent === undefined) continue;

        useWorkbenchStore.getState().updateTabContent(tab.id, file.content, { markDirty: false });
    }
}

function trimTrailingSlash(path: string): string {
    return path.replaceAll(/\/+$/gu, '');
}


