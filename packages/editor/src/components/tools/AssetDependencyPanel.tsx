import { useEffect, useMemo, useState } from 'react';

import {
    addAssetLibraryCollectionToAssets,
    addAssetLibraryMetadataToAssets,
    removeAssetLibraryCollection,
    renameAssetLibraryCollection,
    setAssetLibraryAssetMetadata,
} from '../../services/assetLibraryMetadata';
import { createAssetDependencyGraph } from '../../services/referenceScanner';
import { useProjectStore } from '../../store/storeBootstrap';
import { useReferenceStore } from '../../store/useReferenceStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { ConfirmDialog } from '../ConfirmDialog';
import { AssetAudioCueReviewPanel } from './AssetAudioCueReviewPanel';
import { AssetAudioReviewPanel } from './AssetAudioReviewPanel';
import {
    applyAssetAudioRoleMetadataToLibrary,
    type AssetLibraryAudioRoleFilter,
    collectAssetAudioRoleAssetGroups,
    createAssetAudioRoleSummary,
    filterAssetDependencyGraphByAudioRole,
} from './assetAudioRoleModel';
import { AssetDependencyActionBar } from './AssetDependencyActionBar';
import {
    handleDeleteSelectedUnusedAssets,
    handleImportAssets,
    handleMoveAsset,
    handleOpenAssetUrl,
    handleOpenLocation,
    handlePreviewAssetUrl,
} from './assetDependencyPanelActions';
import {
    type BulkMetadataRequest,
    createBulkMetadataRequest,
} from './assetDependencyPanelBulkMetadata';
import {
    areAllUnusedAssetsSelected,
    type AssetLibraryKindFilter,
    type AssetLibraryOrganizationFilter,
    type AssetLibraryStatusFilter,
    collectAssetDependencyGraphUrls,
    collectAssetUsageEntryUrls,
    createAssetKindSummary,
    createAssetOrganizationSummary,
    createAssetStatusSummary,
    filterAssetDependencyGraph,
    filterAssetDependencyGraphByStatus,
    getAssetLibraryAssetMetadata,
    getSelectedUnusedAssets,
    groupUnusedAssetsByFolder,
    reconcileUnusedAssetSelection,
    removeUnusedAssetScope,
    selectUnusedAssetScope,
    toggleUnusedAssetSelection,
} from './assetDependencyPanelModel';
import { AssetKindFilterPanel } from './AssetKindFilterPanel';
import { AssetLibraryOrganizationPanel } from './AssetLibraryOrganizationPanel';
import { AssetMetadataEditorDialog } from './AssetMetadataEditorDialog';
import { AssetReferenceSection } from './AssetReferenceSection';
import { AssetStatusFilterPanel } from './AssetStatusFilterPanel';
import { AssetUnusedSection } from './AssetUnusedSection';
import { useAssetLibraryMetadata } from './useAssetLibraryMetadata';

export function AssetDependencyPanel() {
    const projectPath = useProjectStore(state => state.projectPath);
    const generation = useProjectStore(state => state.projectGeneration);
    return <AssetDependencyPanelSession key={`${generation}:${projectPath}`} />;
}

function AssetDependencyPanelSession() {
    const uiScale = useSettingsStore((state) => state.uiScale);
    const projectPath = useProjectStore((state) => state.projectPath);
    const result = useReferenceStore((state) => state.result);
    const assetInventory = useReferenceStore((state) => state.assetInventory);
    const generation = useProjectStore(state => state.projectGeneration);
    const library = useAssetLibraryMetadata(projectPath, generation, assetInventory);
    const assetLibraryMetadata = library.metadata;
    const isLoadingAssetMetadata = library.loading;
    const isSavingAssetOrganization = library.saving;

    const [isDeletingUnused, setIsDeletingUnused] = useState(false);
    const [isImportingAssets, setIsImportingAssets] = useState(false);
    const [assetAudioRoleFilter, setAssetAudioRoleFilter] = useState<AssetLibraryAudioRoleFilter>('all');
    const [assetKindFilter, setAssetKindFilter] = useState<AssetLibraryKindFilter>('all');
    const [bulkMetadataRequest, setBulkMetadataRequest] = useState<BulkMetadataRequest>();
    const [assetCollectionPendingRemoval, setAssetCollectionPendingRemoval] = useState<string>();
    const [metadataEditorAssetUrl, setMetadataEditorAssetUrl] = useState<string>();
    const savingMetadataAssetUrl = library.saving ? metadataEditorAssetUrl : undefined;
    const [assetOrganizationFilter, setAssetOrganizationFilter] = useState<AssetLibraryOrganizationFilter>({ kind: 'all' });
    const [assetSearchQuery, setAssetSearchQuery] = useState('');
    const [assetStatusFilter, setAssetStatusFilter] = useState<AssetLibraryStatusFilter>('all');
    const [movingAssetUrl, setMovingAssetUrl] = useState<string>();
    const [selectedUnusedAssets, setSelectedUnusedAssets] = useState<string[]>([]);
    const [showDeleteUnusedDialog, setShowDeleteUnusedDialog] = useState(false);
    const openBulkMetadata = (request: BulkMetadataRequest) => {
        if (!library.disabled && !library.coordinator.getState().saving) setBulkMetadataRequest(request);
    };

    const dependencyGraph = useMemo(
        () => createAssetDependencyGraph(result.assetFiles, assetInventory),
        [assetInventory, result.assetFiles],
    );
    const searchedDependencyGraph = useMemo(
        () => filterAssetDependencyGraph(dependencyGraph, assetSearchQuery, 'all', assetLibraryMetadata),
        [assetLibraryMetadata, assetSearchQuery, dependencyGraph],
    );
    const audioRoleFilteredDependencyGraph = useMemo(
        () => filterAssetDependencyGraphByAudioRole(searchedDependencyGraph, assetAudioRoleFilter),
        [assetAudioRoleFilter, searchedDependencyGraph],
    );
    const kindFilteredDependencyGraph = useMemo(
        () => filterAssetDependencyGraph(audioRoleFilteredDependencyGraph, '', assetKindFilter, assetLibraryMetadata),
        [assetKindFilter, assetLibraryMetadata, audioRoleFilteredDependencyGraph],
    );
    const organizationFilteredDependencyGraph = useMemo(
        () => filterAssetDependencyGraph(
            kindFilteredDependencyGraph,
            '',
            'all',
            assetLibraryMetadata,
            assetOrganizationFilter,
        ),
        [assetLibraryMetadata, assetOrganizationFilter, kindFilteredDependencyGraph],
    );
    const assetStatusSummary = useMemo(
        () => createAssetStatusSummary(organizationFilteredDependencyGraph),
        [organizationFilteredDependencyGraph],
    );
    const filteredDependencyGraph = useMemo(
        () => filterAssetDependencyGraphByStatus(organizationFilteredDependencyGraph, assetStatusFilter),
        [assetStatusFilter, organizationFilteredDependencyGraph],
    );
    const assetKindSummary = useMemo(
        () => createAssetKindSummary(searchedDependencyGraph),
        [searchedDependencyGraph],
    );
    const assetAudioRoleSummary = useMemo(
        () => createAssetAudioRoleSummary(searchedDependencyGraph),
        [searchedDependencyGraph],
    );
    const assetAudioRoleTotal = assetAudioRoleSummary.reduce((total, entry) => total + entry.total, 0);
    const visibleAudioRoleGroups = useMemo(
        () => collectAssetAudioRoleAssetGroups(filteredDependencyGraph),
        [filteredDependencyGraph],
    );
    const visibleAudioRoleAssetCount = visibleAudioRoleGroups.reduce((total, group) => total + group.assetUrls.length, 0);
    const assetOrganizationSummary = useMemo(
        () => createAssetOrganizationSummary(kindFilteredDependencyGraph, assetLibraryMetadata),
        [assetLibraryMetadata, kindFilteredDependencyGraph],
    );
    const visibleAssetUrls = useMemo(
        () => collectAssetDependencyGraphUrls(filteredDependencyGraph),
        [filteredDependencyGraph],
    );
    const visibleUsedAssetUrls = useMemo(
        () => collectAssetUsageEntryUrls(filteredDependencyGraph.used),
        [filteredDependencyGraph.used],
    );
    const visibleMissingAssetUrls = useMemo(
        () => collectAssetUsageEntryUrls(filteredDependencyGraph.missing),
        [filteredDependencyGraph.missing],
    );
    const searchedAssetTotal = searchedDependencyGraph.used.length
        + searchedDependencyGraph.unused.length
        + searchedDependencyGraph.missing.length;
    const isFilteringAssets = assetSearchQuery.trim().length > 0
        || assetAudioRoleFilter !== 'all'
        || assetKindFilter !== 'all'
        || assetOrganizationFilter.kind !== 'all'
        || assetStatusFilter !== 'all';
    const selectedUnusedAssetUrls = useMemo(
        () => getSelectedUnusedAssets(selectedUnusedAssets, filteredDependencyGraph.unused),
        [filteredDependencyGraph.unused, selectedUnusedAssets],
    );
    const selectedUnusedAssetSet = useMemo(() => new Set(selectedUnusedAssetUrls), [selectedUnusedAssetUrls]);
    const unusedFolderGroups = useMemo(
        () => groupUnusedAssetsByFolder(filteredDependencyGraph.unused),
        [filteredDependencyGraph.unused],
    );
    const allUnusedAssetsSelected = areAllUnusedAssetsSelected(selectedUnusedAssetUrls, filteredDependencyGraph.unused);
    const metadataEditorMetadata = metadataEditorAssetUrl
        ? getAssetLibraryAssetMetadata(assetLibraryMetadata, metadataEditorAssetUrl)
        : { collections: [], tags: [] };
    const showUsedAssets = assetStatusFilter === 'all' || assetStatusFilter === 'used';
    const showUnusedAssets = assetStatusFilter === 'all' || assetStatusFilter === 'unused';
    const showMissingAssets = assetStatusFilter === 'all' || assetStatusFilter === 'missing';
    const statusMessage = useMemo(() => createAssetDependencyStatusMessage({
        filteredDependencyGraph,
        isDeletingUnused,
        isFilteringAssets,
        isImportingAssets,
        isLoadingAssetMetadata,
        isSavingAssetOrganization,
        movingAssetUrl,
        savingMetadataAssetUrl,
        totalDependencyGraph: dependencyGraph,
    }), [
        dependencyGraph,
        filteredDependencyGraph,
        isDeletingUnused,
        isFilteringAssets,
        isImportingAssets,
        isLoadingAssetMetadata,
        isSavingAssetOrganization,
        movingAssetUrl,
        savingMetadataAssetUrl,
    ]);

    useEffect(() => {
        setSelectedUnusedAssets((current) => reconcileUnusedAssetSelection(current, dependencyGraph.unused));
    }, [dependencyGraph.unused]);


    if (!projectPath) {
        return <div style={{ color: t.text.faint, fontStyle: 'italic', padding: `${12 * uiScale}px` }}>Open a project to analyze assets.</div>;
    }

    return (
        <div
            aria-busy={isDeletingUnused || isImportingAssets || isLoadingAssetMetadata || isSavingAssetOrganization || movingAssetUrl !== undefined || savingMetadataAssetUrl !== undefined}
            className="zerith-scrollbar"
            style={{
                background: t.bg.app,
                color: t.text.normal,
                display: 'flex',
                flexDirection: 'column',
                gap: `${8 * uiScale}px`,
                height: '100%',
                overflow: 'auto',
                padding: `${10 * uiScale}px`,
            }}
        >
            <strong>Asset Dependencies</strong>

            <div aria-live="polite" role="status" style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                {statusMessage}
            </div>

            {library.error ? (
                <div role="alert">
                    Asset metadata could not be loaded or saved. {library.error}
                    <button disabled={library.loading || library.saving} onClick={() => { void library.coordinator.load(); }} type="button">Retry metadata load</button>
                </div>
            ) : undefined}

            <AssetKindFilterPanel
                filter={assetKindFilter}
                onFilterChange={(filter) => {
                    setAssetKindFilter(filter);
                    if (filter !== 'all') {
                        setAssetAudioRoleFilter('all');
                    }
                }}
                summary={assetKindSummary}
                total={searchedAssetTotal}
                uiScale={uiScale}
            />

            <AssetAudioReviewPanel
                filter={assetAudioRoleFilter}
                isApplyingRoleLabels={library.disabled}
                onApplyRoleLabels={() => {
                    void library.coordinator.mutate(
                        metadata => applyAssetAudioRoleMetadataToLibrary(metadata, visibleAudioRoleGroups).metadata,
                        `Applied audio role labels to ${visibleAudioRoleAssetCount} visible audio assets.`,
                    );
                }}
                onFilterChange={(filter) => {
                    setAssetAudioRoleFilter(filter);
                    if (filter !== 'all') {
                        setAssetKindFilter('all');
                    }
                }}
                roleLabelAssetCount={visibleAudioRoleAssetCount}
                summary={assetAudioRoleSummary}
                total={assetAudioRoleTotal}
                uiScale={uiScale}
            />

            <AssetLibraryOrganizationPanel
                busy={library.disabled}
                filter={assetOrganizationFilter}
                isLoading={isLoadingAssetMetadata}
                onAddCollectionToVisible={(collection) => {
                    return library.coordinator.mutate(
                        metadata => addAssetLibraryCollectionToAssets(metadata, visibleAssetUrls, collection),
                        `Added ${visibleAssetUrls.length} visible assets to collection "${collection.trim()}".`,
                    );
                }}
                onFilterChange={setAssetOrganizationFilter}
                onRemoveCollection={setAssetCollectionPendingRemoval}
                onRenameCollection={(oldCollection, newCollection) => {
                    return library.coordinator.mutate(
                        metadata => renameAssetLibraryCollection(metadata, oldCollection, newCollection),
                        `Renamed asset collection "${oldCollection}" to "${newCollection.trim()}".`,
                    );
                }}
                summary={assetOrganizationSummary}
                uiScale={uiScale}
                visibleAssetCount={visibleAssetUrls.length}
            />

            <AssetStatusFilterPanel
                filter={assetStatusFilter}
                onFilterChange={setAssetStatusFilter}
                summary={assetStatusSummary}
                uiScale={uiScale}
            />

            <AssetAudioCueReviewPanel
                assetInventory={assetInventory}
                assetUrls={visibleAssetUrls}
                onOpenAsset={(assetUrl) => {
                    void handleOpenAssetUrl(projectPath, assetUrl);
                }}
                onOpenSourceAsset={(assetUrl) => {
                    void handlePreviewAssetUrl(projectPath, assetUrl);
                }}
                onOrganizeCueAssets={library.disabled ? undefined : (assetUrls) => openBulkMetadata(createBulkMetadataRequest(
                    assetUrls,
                    'cue-linked asset',
                    'cue-linked',
                    'Organize Visible Cue Assets',
                ))}
                projectPath={projectPath}
                uiScale={uiScale}
            />

            <AssetDependencyActionBar
                assetSearchQuery={assetSearchQuery}
                isDeletingUnused={isDeletingUnused}
                isFilteringAssets={isFilteringAssets}
                isImportingAssets={isImportingAssets}
                isOrganizingVisible={library.disabled}
                onClearFilters={() => {
                    setAssetSearchQuery('');
                    setAssetAudioRoleFilter('all');
                    setAssetKindFilter('all');
                    setAssetOrganizationFilter({ kind: 'all' });
                    setAssetStatusFilter('all');
                }}
                onDeleteSelectedUnused={() => setShowDeleteUnusedDialog(true)}
                onImportAssets={() => {
                    void handleImportAssets(projectPath, setIsImportingAssets);
                }}
                onOrganizeVisible={() => openBulkMetadata(createBulkMetadataRequest(
                    visibleAssetUrls,
                    'visible asset',
                    'visible',
                    'Organize Visible Assets',
                ))}
                onSearchQueryChange={setAssetSearchQuery}
                selectedUnusedCount={selectedUnusedAssetUrls.length}
                uiScale={uiScale}
                visibleAssetCount={visibleAssetUrls.length}
            />

            {showUsedAssets ? (
                <AssetReferenceSection
                    assetLibraryMetadata={assetLibraryMetadata}
                    bulkDisabled={library.disabled}
                    emptyMessage={isFilteringAssets ? 'No used assets match the current filter.' : 'No asset references found in scripts/macros.'}
                    entries={filteredDependencyGraph.used}
                    movingAssetUrl={movingAssetUrl}
                    onEditMetadata={(assetUrl) => { if (!library.disabled) setMetadataEditorAssetUrl(assetUrl); }}
                    onMoveAsset={(assetUrl) => {
                        void handleMoveAsset(projectPath, assetUrl, setMovingAssetUrl);
                    }}
                    onOpenLocation={handleOpenLocation}
                    onOrganizeVisible={() => openBulkMetadata(createBulkMetadataRequest(
                        visibleUsedAssetUrls,
                        'visible used asset',
                        'used',
                        'Organize Visible Used Assets',
                    ))}
                    subtitleForEntry={(entry) => `references: ${entry.references.length}`}
                    title="Used assets"
                    uiScale={uiScale}
                />
            ) : undefined}

            {showUnusedAssets ? (
                <AssetUnusedSection
                    allUnusedAssetsSelected={allUnusedAssetsSelected}
                    assetLibraryMetadata={assetLibraryMetadata}
                    assetUrls={filteredDependencyGraph.unused}
                    isFilteringAssets={isFilteringAssets}
                    metadataDisabled={library.disabled}
                    movingAssetUrl={movingAssetUrl}
                    onClearVisible={() => setSelectedUnusedAssets((current) => removeUnusedAssetScope(current, filteredDependencyGraph.unused))}
                    onEditMetadata={(assetUrl) => { if (!library.disabled) setMetadataEditorAssetUrl(assetUrl); }}
                    onMoveAsset={(assetUrl) => {
                        void handleMoveAsset(projectPath, assetUrl, setMovingAssetUrl);
                    }}
                    onOrganizeSelected={() => openBulkMetadata(createBulkMetadataRequest(
                        selectedUnusedAssetUrls,
                        'selected unused asset',
                        'selected unused',
                        'Organize Selected Assets',
                    ))}
                    onSelectFolder={setSelectedUnusedAssets}
                    onSelectVisible={() => setSelectedUnusedAssets((current) => selectUnusedAssetScope(current, filteredDependencyGraph.unused))}
                    onToggleAssetSelection={(assetUrl, selected) => {
                        setSelectedUnusedAssets((current) => toggleUnusedAssetSelection(current, assetUrl, selected));
                    }}
                    savingMetadataAssetUrl={savingMetadataAssetUrl}
                    selectedAssetSet={selectedUnusedAssetSet}
                    selectedCount={selectedUnusedAssetUrls.length}
                    uiScale={uiScale}
                    unusedFolderGroups={unusedFolderGroups}
                />
            ) : undefined}

            {showMissingAssets ? (
                <AssetReferenceSection
                    assetLibraryMetadata={assetLibraryMetadata}
                    bulkDisabled={library.disabled}
                    emptyMessage={isFilteringAssets ? 'No missing assets match the current filter.' : 'No missing assets referenced.'}
                    entries={filteredDependencyGraph.missing}
                    onEditMetadata={(assetUrl) => { if (!library.disabled) setMetadataEditorAssetUrl(assetUrl); }}
                    onOpenLocation={handleOpenLocation}
                    onOrganizeVisible={() => openBulkMetadata(createBulkMetadataRequest(
                        visibleMissingAssetUrls,
                        'visible missing asset',
                        'missing',
                        'Organize Visible Missing Assets',
                    ))}
                    subtitleForEntry={(entry) => `missing | references: ${entry.references.length}`}
                    title="Missing referenced assets"
                    uiScale={uiScale}
                />
            ) : undefined}

            {metadataEditorAssetUrl ? <AssetMetadataEditorDialog
                assetUrl={metadataEditorAssetUrl}
                busy={library.saving || library.loading}
                error={library.error}
                key={metadataEditorAssetUrl}
                metadata={metadataEditorMetadata}
                onCancel={() => {
                    if (savingMetadataAssetUrl) return;
                    setMetadataEditorAssetUrl(undefined);
                }}
                onRetry={() => { void library.coordinator.load(); }}
                onSave={(assetMetadata) => {
                    if (!metadataEditorAssetUrl) return;
                    const assetUrl = metadataEditorAssetUrl;
                    void library.coordinator.mutate(
                        metadata => setAssetLibraryAssetMetadata(metadata, assetUrl, assetMetadata),
                        `Updated asset organization for ${assetUrl}.`,
                    ).then(saved => {
                        if (saved && library.coordinator.ownsSession()) setMetadataEditorAssetUrl(current => current === assetUrl ? undefined : current);
                    });
                }}
                saveDisabled={!library.ready}
                uiScale={uiScale}
            /> : undefined}

            {bulkMetadataRequest ? <AssetMetadataEditorDialog
                busy={library.saving || library.loading}
                emptyPreviewText="No labels to apply"
                error={library.error}
                key={bulkMetadataRequest.subject}
                metadata={{ collections: [], tags: [] }}
                onCancel={() => {
                    if (isSavingAssetOrganization) return;
                    setBulkMetadataRequest(undefined);
                }}
                onRetry={() => { void library.coordinator.load(); }}
                onSave={(assetMetadata) => {
                    if (!bulkMetadataRequest) return;
                    const request = bulkMetadataRequest;
                    void library.coordinator.mutate(
                        metadata => addAssetLibraryMetadataToAssets(metadata, request.assetUrls, assetMetadata),
                        `Updated metadata for ${request.assetUrls.length} ${request.scopeLabel}s.`,
                    ).then(saved => {
                        if (saved && library.coordinator.ownsSession()) setBulkMetadataRequest(current => current === request ? undefined : current);
                    });
                }}
                saveDisabled={!library.ready}
                saveText="Apply labels"
                subject={bulkMetadataRequest?.subject}
                title={bulkMetadataRequest?.title ?? 'Organize Assets'}
                uiScale={uiScale}
            /> : undefined}

            <ConfirmDialog
                cancelText="Cancel"
                confirmText={isDeletingUnused ? 'Deleting...' : 'Delete'}
                danger
                message={`Delete ${selectedUnusedAssetUrls.length} selected unused asset${selectedUnusedAssetUrls.length === 1 ? '' : 's'}? This cannot be undone.`}
                onCancel={() => {
                    if (isDeletingUnused) return;
                    setShowDeleteUnusedDialog(false);
                }}
                onConfirm={() => {
                    void handleDeleteSelectedUnusedAssets(
                        projectPath,
                        selectedUnusedAssetUrls,
                        setIsDeletingUnused,
                        setSelectedUnusedAssets,
                        setShowDeleteUnusedDialog,
                    );
                }}
                open={showDeleteUnusedDialog}
                title="Delete unused assets?"
            />

            <ConfirmDialog
                cancelText="Cancel"
                confirmText={isSavingAssetOrganization ? 'Removing...' : 'Remove'}
                danger
                message={`Remove collection "${assetCollectionPendingRemoval ?? ''}" from every asset in this project? Asset files are not deleted.`}
                onCancel={() => {
                    if (isSavingAssetOrganization) return;
                    setAssetCollectionPendingRemoval(undefined);
                }}
                onConfirm={() => {
                    if (!assetCollectionPendingRemoval) return;
                    const collection = assetCollectionPendingRemoval;
                    void library.coordinator.mutate(
                        metadata => removeAssetLibraryCollection(metadata, collection),
                        `Removed asset collection "${collection}".`,
                    ).then(saved => {
                        if (saved && library.coordinator.ownsSession()) setAssetCollectionPendingRemoval(current => current === collection ? undefined : current);
                    });
                }}
                open={Boolean(assetCollectionPendingRemoval)}
                title="Remove asset collection?"
            />
        </div>
    );
}

function createAssetDependencyStatusMessage({
    filteredDependencyGraph,
    isDeletingUnused,
    isFilteringAssets,
    isImportingAssets,
    isLoadingAssetMetadata,
    isSavingAssetOrganization,
    movingAssetUrl,
    savingMetadataAssetUrl,
    totalDependencyGraph,
}: {
    filteredDependencyGraph: ReturnType<typeof createAssetDependencyGraph>;
    isDeletingUnused: boolean;
    isFilteringAssets: boolean;
    isImportingAssets: boolean;
    isLoadingAssetMetadata: boolean;
    isSavingAssetOrganization: boolean;
    movingAssetUrl: string | undefined;
    savingMetadataAssetUrl: string | undefined;
    totalDependencyGraph: ReturnType<typeof createAssetDependencyGraph>;
}): string {
    const countSummary = `Used: ${formatFilteredCount(filteredDependencyGraph.used.length, totalDependencyGraph.used.length, isFilteringAssets)} | Unused: ${formatFilteredCount(filteredDependencyGraph.unused.length, totalDependencyGraph.unused.length, isFilteringAssets)} | Missing: ${formatFilteredCount(filteredDependencyGraph.missing.length, totalDependencyGraph.missing.length, isFilteringAssets)}`;
    if (isImportingAssets) return `Importing assets. ${countSummary}`;
    if (isDeletingUnused) return `Deleting selected unused assets. ${countSummary}`;
    if (isSavingAssetOrganization) return `Saving asset organization metadata. ${countSummary}`;
    if (isLoadingAssetMetadata) return `Loading asset metadata. ${countSummary}`;
    if (movingAssetUrl) return `Moving ${movingAssetUrl}. ${countSummary}`;
    if (savingMetadataAssetUrl) return `Saving metadata for ${savingMetadataAssetUrl}. ${countSummary}`;
    return countSummary;
}

function formatFilteredCount(visibleCount: number, totalCount: number, isFiltering: boolean): string {
    return isFiltering ? `${visibleCount}/${totalCount}` : String(totalCount);
}
