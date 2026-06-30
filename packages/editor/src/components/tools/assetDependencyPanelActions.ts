import { importAssetsFromPicker } from '../../services/assetImport';
import {
    addAssetLibraryCollectionToAssets,
    addAssetLibraryMetadataToAssets,
    type AssetLibraryAssetMetadata,
    type AssetLibraryMetadata,
    removeAssetLibraryCollection,
    renameAssetLibraryCollection,
    saveAssetLibraryMetadata,
    setAssetLibraryAssetMetadata,
} from '../../services/assetLibraryMetadata';
import { deletePaths, moveAssetPathWithPicker, refreshProjectTree } from '../../services/explorerFileActions';
import { fsJoin } from '../../services/fs';
import { openAssetEntry, openProjectEntry } from '../../services/openProjectEntry';
import { type ReferenceLocation, refreshReferenceScannerState } from '../../services/referenceScanner';
import { executeConsoleMessageAction } from '../../store/actions/consoleMessageActions';
import { useEditorStore } from '../../store/useEditorStore';
import {
    applyAssetAudioRoleMetadataToLibrary,
    type AssetAudioRoleAssetGroup,
} from './assetAudioRoleModel';
import { projectRelativeAssetPathFromUrl } from './assetDependencyPanelModel';

export async function handleAddAssetMetadataToAssets(
    projectPath: string,
    assetUrls: readonly string[],
    assetMetadata: AssetLibraryAssetMetadata,
    metadata: AssetLibraryMetadata,
    setAssetLibraryMetadata: (metadata: AssetLibraryMetadata) => void,
    setIsSavingAssetOrganization: (value: boolean) => void,
    scopeLabel: string,
): Promise<void> {
    if (assetUrls.length === 0 || (assetMetadata.collections.length === 0 && assetMetadata.tags.length === 0)) return;
    const nextMetadata = addAssetLibraryMetadataToAssets(metadata, assetUrls, assetMetadata);
    await persistAssetLibraryMetadataUpdate(
        projectPath,
        nextMetadata,
        setAssetLibraryMetadata,
        setIsSavingAssetOrganization,
        `Updated metadata for ${assetUrls.length} ${scopeLabel}${assetUrls.length === 1 ? '' : 's'}.`,
    );
}

export async function handleAddVisibleAssetCollection(
    projectPath: string,
    assetUrls: readonly string[],
    collection: string,
    metadata: AssetLibraryMetadata,
    setAssetLibraryMetadata: (metadata: AssetLibraryMetadata) => void,
    setIsSavingAssetOrganization: (value: boolean) => void,
): Promise<void> {
    if (assetUrls.length === 0) return;
    const nextMetadata = addAssetLibraryCollectionToAssets(metadata, assetUrls, collection);
    await persistAssetLibraryMetadataUpdate(
        projectPath,
        nextMetadata,
        setAssetLibraryMetadata,
        setIsSavingAssetOrganization,
        `Added ${assetUrls.length} visible asset${assetUrls.length === 1 ? '' : 's'} to collection "${collection.trim()}".`,
    );
}

export async function handleApplyAssetAudioRoleMetadata(
    projectPath: string,
    audioRoleGroups: readonly AssetAudioRoleAssetGroup[],
    metadata: AssetLibraryMetadata,
    setAssetLibraryMetadata: (metadata: AssetLibraryMetadata) => void,
    setIsSavingAssetOrganization: (value: boolean) => void,
): Promise<void> {
    const result = applyAssetAudioRoleMetadataToLibrary(metadata, audioRoleGroups);
    if (result.assetCount === 0) return;

    await persistAssetLibraryMetadataUpdate(
        projectPath,
        result.metadata,
        setAssetLibraryMetadata,
        setIsSavingAssetOrganization,
        `Applied audio role labels to ${result.assetCount} visible audio asset${result.assetCount === 1 ? '' : 's'}.`,
    );
}

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

export async function handleRemoveAssetCollection(
    projectPath: string,
    collection: string,
    metadata: AssetLibraryMetadata,
    setAssetLibraryMetadata: (metadata: AssetLibraryMetadata) => void,
    setIsSavingAssetOrganization: (value: boolean) => void,
    setAssetCollectionPendingRemoval: (value: string | undefined) => void,
): Promise<void> {
    const nextMetadata = removeAssetLibraryCollection(metadata, collection);
    try {
        await persistAssetLibraryMetadataUpdate(
            projectPath,
            nextMetadata,
            setAssetLibraryMetadata,
            setIsSavingAssetOrganization,
            `Removed asset collection "${collection}".`,
        );
        setAssetCollectionPendingRemoval(undefined);
    } catch {
        // persistAssetLibraryMetadataUpdate already reports the save failure.
    }
}

export async function handleRenameAssetCollection(
    projectPath: string,
    oldCollection: string,
    newCollection: string,
    metadata: AssetLibraryMetadata,
    setAssetLibraryMetadata: (metadata: AssetLibraryMetadata) => void,
    setIsSavingAssetOrganization: (value: boolean) => void,
): Promise<void> {
    const nextMetadata = renameAssetLibraryCollection(metadata, oldCollection, newCollection);
    await persistAssetLibraryMetadataUpdate(
        projectPath,
        nextMetadata,
        setAssetLibraryMetadata,
        setIsSavingAssetOrganization,
        `Renamed asset collection "${oldCollection}" to "${newCollection.trim()}".`,
    );
}

export async function handleSaveAssetMetadata(
    projectPath: string,
    assetUrl: string,
    assetMetadata: AssetLibraryAssetMetadata,
    metadata: AssetLibraryMetadata,
    setAssetLibraryMetadata: (metadata: AssetLibraryMetadata) => void,
    setSavingMetadataAssetUrl: (assetUrl: string | undefined) => void,
): Promise<void> {
    const nextMetadata = setAssetLibraryAssetMetadata(metadata, assetUrl, assetMetadata);

    setSavingMetadataAssetUrl(assetUrl);
    try {
        await saveAssetLibraryMetadata(projectPath, nextMetadata);
        setAssetLibraryMetadata(nextMetadata);
        await refreshAssetLibraryAfterMetadataWrite();
        executeConsoleMessageAction('editor', 'info', `Updated asset organization for ${assetUrl}.`);
    } catch (error) {
        console.error('Asset library metadata save failed:', error);
        executeConsoleMessageAction('editor', 'error', 'Asset library metadata save failed:', String(error));
        throw error;
    } finally {
        setSavingMetadataAssetUrl(undefined);
    }
}

function basename(path: string): string {
    return path.split(/[\\/]/).pop() || path;
}

async function persistAssetLibraryMetadataUpdate(
    projectPath: string,
    nextMetadata: AssetLibraryMetadata,
    setAssetLibraryMetadata: (metadata: AssetLibraryMetadata) => void,
    setIsSavingAssetOrganization: (value: boolean) => void,
    successMessage: string,
): Promise<void> {
    setIsSavingAssetOrganization(true);
    try {
        await saveAssetLibraryMetadata(projectPath, nextMetadata);
        setAssetLibraryMetadata(nextMetadata);
        await refreshAssetLibraryAfterMetadataWrite();
        executeConsoleMessageAction('editor', 'info', successMessage);
    } catch (error) {
        console.error('Asset library metadata save failed:', error);
        executeConsoleMessageAction('editor', 'error', 'Asset library metadata save failed:', String(error));
        throw error;
    } finally {
        setIsSavingAssetOrganization(false);
    }
}

async function refreshAssetLibraryAfterMetadataWrite(): Promise<void> {
    try {
        await refreshReferenceScannerState();
    } catch (error) {
        console.error('Asset library reference refresh failed:', error);
        executeConsoleMessageAction(
            'editor',
            'warn',
            'Asset library metadata saved, but reference refresh failed:',
            String(error),
        );
    }
}
