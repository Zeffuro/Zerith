import { AssetImportError, importAssetsFromPicker } from '../../services/assetImport';
import { deletePaths, moveAssetPathWithPicker, refreshProjectTree } from '../../services/explorerFileActions';
import { fsJoin } from '../../services/fs';
import { openAssetEntry, openProjectEntry } from '../../services/openProjectEntry';
import { type ReferenceLocation, refreshReferenceScannerState } from '../../services/referenceScanner';
import { executeConsoleMessageAction } from '../../store/actions/consoleMessageActions';
import { useEditorStore } from '../../store/useEditorStore';
import { projectRelativeAssetPathFromUrl } from './assetDependencyPanelModel';

export async function handleDeleteSelectedUnusedAssets(
    projectPath: string,
    selectedUnusedAssetUrls: readonly string[],
    setIsDeletingUnused: (value: boolean) => void,
    setSelectedUnusedAssets: (value: string[]) => void,
    setShowDeleteUnusedDialog: (value: boolean) => void,
): Promise<void> {
    setIsDeletingUnused(true);
    try {
        const filePaths = await Promise.all(
            selectedUnusedAssetUrls.map((assetUrl) => {
                const normalizedAsset = assetUrl.replace(/^\/+/, '');
                return fsJoin(projectPath, normalizedAsset);
            }),
        );
        await deletePaths(filePaths);
        await refreshReferenceScannerState();
        setSelectedUnusedAssets([]);
    } finally {
        setIsDeletingUnused(false);
        setShowDeleteUnusedDialog(false);
    }
}

export async function handleImportAssets(
    projectPath: string,
    setIsImportingAssets: (value: boolean) => void,
): Promise<void> {
    if (!projectPath) return;

    setIsImportingAssets(true);
    try {
        const result = await importAssetsFromPicker(projectPath);
        if (result.imported.length === 0) {
            executeConsoleMessageAction('editor', 'info', 'Asset import cancelled or no files selected.');
            return;
        }

        await refreshProjectTree();
        await refreshReferenceScannerState();
        executeConsoleMessageAction(
            'editor',
            'info',
            `Imported ${result.imported.length} asset${result.imported.length === 1 ? '' : 's'}:`,
            result.imported.map((entry) => entry.assetUrl).join(', '),
        );
    } catch (error) {
        console.error('Asset import failed:', error);
        executeConsoleMessageAction('editor', 'error', 'Asset import failed:', String(error));
        if (error instanceof AssetImportError && error.imported.length > 0) {
            await refreshProjectTree();
            await refreshReferenceScannerState();
        }
    } finally {
        setIsImportingAssets(false);
    }
}

export async function handleMoveAsset(
    projectPath: string,
    assetUrl: string,
    setMovingAssetUrl: (value: string | undefined) => void,
): Promise<void> {
    const relativeAssetPath = projectRelativeAssetPathFromUrl(assetUrl);
    if (!relativeAssetPath) {
        executeConsoleMessageAction('editor', 'warn', `Move asset aborted: '${assetUrl}' is not a project asset URL.`);
        return;
    }

    setMovingAssetUrl(assetUrl);
    try {
        const assetFilePath = await fsJoin(projectPath, relativeAssetPath);
        await moveAssetPathWithPicker(assetFilePath);
    } finally {
        setMovingAssetUrl(undefined);
    }
}

export async function handleOpenAssetUrl(projectPath: string, assetUrl: string): Promise<void> {
    const relativeAssetPath = projectRelativeAssetPathFromUrl(assetUrl);
    if (!relativeAssetPath) {
        executeConsoleMessageAction('editor', 'warn', `Open asset aborted: '${assetUrl}' is not a project asset URL.`);
        return;
    }

    const assetPath = await fsJoin(projectPath, relativeAssetPath);
    await openProjectEntry(assetPath, basename(assetPath));
}

export async function handleOpenLocation(location: ReferenceLocation) {
    await openProjectEntry(location.filePath, basename(location.filePath), { forceView: 'timeline' });
    const editor = useEditorStore.getState();
    editor.setSelectedNodePaths([location.path]);
    editor.setSelectionAnchorPath(location.path);
}

export async function handlePreviewAssetUrl(projectPath: string, assetUrl: string): Promise<void> {
    const relativeAssetPath = projectRelativeAssetPathFromUrl(assetUrl);
    if (!relativeAssetPath) {
        executeConsoleMessageAction('editor', 'warn', `Open asset aborted: '${assetUrl}' is not a project asset URL.`);
        return;
    }

    const assetPath = await fsJoin(projectPath, relativeAssetPath);
    openAssetEntry(assetPath);
}

function basename(path: string): string {
    return path.split(/[\\/]/).pop() || path;
}
