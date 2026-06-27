import { CheckSquare, FolderInput, Search, Square, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { ReferenceLocation } from '../../services/referenceScanner';

import { importAssetsFromPicker } from '../../services/assetImport';
import { deletePaths, moveAssetPathWithPicker, refreshProjectTree } from '../../services/explorerFileActions';
import { fsJoin } from '../../services/fs';
import { openProjectEntry } from '../../services/openProjectEntry';
import { createAssetDependencyGraph, refreshReferenceScannerState } from '../../services/referenceScanner';
import { executeConsoleMessageAction } from '../../store/actions/consoleMessageActions';
import { useProjectStore } from '../../store/storeBootstrap';
import { useEditorStore } from '../../store/useEditorStore';
import { useReferenceStore } from '../../store/useReferenceStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { ConfirmDialog } from '../ConfirmDialog';
import {
    areAllUnusedAssetsSelected,
    type AssetLibraryKindFilter,
    createAssetKindSummary,
    filterAssetDependencyGraph,
    getSelectedUnusedAssets,
    groupUnusedAssetsByFolder,
    projectRelativeAssetPathFromUrl,
    reconcileUnusedAssetSelection,
    removeUnusedAssetScope,
    selectUnusedAssetScope,
    toggleUnusedAssetSelection,
} from './assetDependencyPanelModel';

export function AssetDependencyPanel() {
    const uiScale = useSettingsStore((state) => state.uiScale);
    const projectPath = useProjectStore((state) => state.projectPath);
    const result = useReferenceStore((state) => state.result);
    const assetInventory = useReferenceStore((state) => state.assetInventory);

    const [isDeletingUnused, setIsDeletingUnused] = useState(false);
    const [isImportingAssets, setIsImportingAssets] = useState(false);
    const [assetKindFilter, setAssetKindFilter] = useState<AssetLibraryKindFilter>('all');
    const [assetSearchQuery, setAssetSearchQuery] = useState('');
    const [movingAssetUrl, setMovingAssetUrl] = useState<string>();
    const [selectedUnusedAssets, setSelectedUnusedAssets] = useState<string[]>([]);
    const [showDeleteUnusedDialog, setShowDeleteUnusedDialog] = useState(false);

    const dependencyGraph = useMemo(
        () => createAssetDependencyGraph(result.assetFiles, assetInventory),
        [assetInventory, result.assetFiles],
    );
    const searchedDependencyGraph = useMemo(
        () => filterAssetDependencyGraph(dependencyGraph, assetSearchQuery),
        [assetSearchQuery, dependencyGraph],
    );
    const filteredDependencyGraph = useMemo(
        () => filterAssetDependencyGraph(searchedDependencyGraph, '', assetKindFilter),
        [assetKindFilter, searchedDependencyGraph],
    );
    const assetKindSummary = useMemo(
        () => createAssetKindSummary(searchedDependencyGraph),
        [searchedDependencyGraph],
    );
    const searchedAssetTotal = searchedDependencyGraph.used.length
        + searchedDependencyGraph.unused.length
        + searchedDependencyGraph.missing.length;
    const isFilteringAssets = assetSearchQuery.trim().length > 0 || assetKindFilter !== 'all';
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

    useEffect(() => {
        setSelectedUnusedAssets((current) => reconcileUnusedAssetSelection(current, dependencyGraph.unused));
    }, [dependencyGraph.unused]);

    if (!projectPath) {
        return <div style={{ color: t.text.faint, fontStyle: 'italic', padding: `${12 * uiScale}px` }}>Open a project to analyze assets.</div>;
    }

    return (
        <div
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

            <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                Used: {formatFilteredCount(filteredDependencyGraph.used.length, dependencyGraph.used.length, isFilteringAssets)} | Unused: {formatFilteredCount(filteredDependencyGraph.unused.length, dependencyGraph.unused.length, isFilteringAssets)} | Missing: {formatFilteredCount(filteredDependencyGraph.missing.length, dependencyGraph.missing.length, isFilteringAssets)}
            </div>

            {assetKindSummary.length > 0 ? (
                <div style={kindSummaryRowStyle(uiScale)}>
                    <button
                        className="toolbar-btn"
                        onClick={() => setAssetKindFilter('all')}
                        style={kindSummaryChipStyle(uiScale, assetKindFilter === 'all')}
                        type="button"
                    >
                        All {searchedAssetTotal}
                    </button>
                    {assetKindSummary.map((summary) => (
                        <button
                            className="toolbar-btn"
                            key={summary.kind}
                            onClick={() => setAssetKindFilter((current) => current === summary.kind ? 'all' : summary.kind)}
                            style={kindSummaryChipStyle(uiScale, assetKindFilter === summary.kind)}
                            type="button"
                        >
                            {formatAssetKind(summary.kind)} {summary.total}
                            <span style={{ color: t.text.faint }}>
                                {' '}({summary.used}/{summary.unused}/{summary.missing})
                            </span>
                        </button>
                    ))}
                </div>
            ) : undefined}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${6 * uiScale}px` }}>
                <button
                    className="toolbar-btn"
                    disabled={isImportingAssets}
                    onClick={() => {
                        void handleImportAssets(projectPath, setIsImportingAssets);
                    }}
                    style={actionButtonStyle(uiScale, isImportingAssets)}
                    type="button"
                >
                    <Upload size={14 * uiScale} />
                    <span>{isImportingAssets ? 'Importing assets...' : 'Import assets...'}</span>
                </button>

                <button
                    className="toolbar-btn"
                    disabled={selectedUnusedAssetUrls.length === 0 || isDeletingUnused}
                    onClick={() => setShowDeleteUnusedDialog(true)}
                    style={actionButtonStyle(uiScale, selectedUnusedAssetUrls.length === 0 || isDeletingUnused, selectedUnusedAssetUrls.length > 0)}
                    type="button"
                >
                    <Trash2 size={14 * uiScale} />
                    <span>{isDeletingUnused ? 'Deleting unused assets...' : `Delete selected unused assets (${selectedUnusedAssetUrls.length})`}</span>
                </button>
            </div>

            <label style={searchBoxStyle(uiScale)}>
                <Search size={14 * uiScale} />
                <input
                    aria-label="Filter asset dependencies"
                    onChange={(event) => setAssetSearchQuery(event.currentTarget.value)}
                    placeholder="Filter assets, scenes, commands, or paths"
                    style={searchInputStyle(uiScale)}
                    type="search"
                    value={assetSearchQuery}
                />
            </label>

            <section style={sectionStyle(uiScale)}>
                <div style={sectionHeaderStyle(uiScale)}>Used assets</div>
                {filteredDependencyGraph.used.length === 0 && (
                    <div style={{ color: t.text.faint, fontStyle: 'italic' }}>
                        {isFilteringAssets ? 'No used assets match the current filter.' : 'No asset references found in scripts/macros.'}
                    </div>
                )}
                {filteredDependencyGraph.used.map((entry) => (
                    <EntryBlock
                        key={`used-${entry.assetUrl}`}
                        locations={entry.references}
                        moveDisabled={!!movingAssetUrl}
                        moving={movingAssetUrl === entry.assetUrl}
                        name={entry.assetUrl}
                        onMoveAsset={(assetUrl) => {
                            void handleMoveAsset(projectPath, assetUrl, setMovingAssetUrl);
                        }}
                        onOpenLocation={handleOpenLocation}
                        subtitle={`references: ${entry.references.length}`}
                        uiScale={uiScale}
                    />
                ))}
            </section>

            <section style={sectionStyle(uiScale)}>
                <div style={sectionTitleRowStyle(uiScale)}>
                    <div style={sectionHeaderStyle(uiScale)}>Unused assets</div>
                    <div style={{ display: 'flex', gap: `${6 * uiScale}px` }}>
                        <button
                            className="toolbar-btn"
                            disabled={filteredDependencyGraph.unused.length === 0 || allUnusedAssetsSelected}
                            onClick={() => setSelectedUnusedAssets((current) => selectUnusedAssetScope(current, filteredDependencyGraph.unused))}
                            style={miniButtonStyle(uiScale, filteredDependencyGraph.unused.length === 0 || allUnusedAssetsSelected)}
                            title={isFilteringAssets ? 'Select visible unused assets' : 'Select all unused assets'}
                            type="button"
                        >
                            <CheckSquare size={13 * uiScale} />
                            <span>{isFilteringAssets ? 'Select visible' : 'Select all'}</span>
                        </button>
                        <button
                            className="toolbar-btn"
                            disabled={selectedUnusedAssetUrls.length === 0}
                            onClick={() => setSelectedUnusedAssets((current) => removeUnusedAssetScope(current, filteredDependencyGraph.unused))}
                            style={miniButtonStyle(uiScale, selectedUnusedAssetUrls.length === 0)}
                            title={isFilteringAssets ? 'Clear visible unused asset selection' : 'Clear unused asset selection'}
                            type="button"
                        >
                            <Square size={13 * uiScale} />
                            <span>{isFilteringAssets ? 'Clear visible' : 'Clear'}</span>
                        </button>
                    </div>
                </div>
                <div style={{ color: t.text.faint, fontSize: `${11 * uiScale}px` }}>
                    {isFilteringAssets ? 'Selected visible for cleanup' : 'Selected for cleanup'}: {selectedUnusedAssetUrls.length}
                </div>
                {unusedFolderGroups.length > 1 ? (
                    <div style={folderGroupGridStyle(uiScale)}>
                        {unusedFolderGroups.map((group) => {
                            const selectedCount = group.assetUrls.filter((assetUrl) => selectedUnusedAssetSet.has(assetUrl)).length;
                            return (
                                <button
                                    className="toolbar-btn"
                                    key={group.folder}
                                    onClick={() => setSelectedUnusedAssets(group.assetUrls)}
                                    style={folderGroupButtonStyle(uiScale, selectedCount === group.assetUrls.length)}
                                    title={`Select unused assets in ${group.folder}`}
                                    type="button"
                                >
                                    <FolderInput size={13 * uiScale} />
                                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.folder}</span>
                                    <span style={{ color: t.text.faint, marginLeft: 'auto' }}>{selectedCount}/{group.assetUrls.length}</span>
                                </button>
                            );
                        })}
                    </div>
                ) : undefined}
                {filteredDependencyGraph.unused.length === 0 && (
                    <div style={{ color: t.text.faint, fontStyle: 'italic' }}>
                        {isFilteringAssets ? 'No unused assets match the current filter.' : 'No unused assets detected.'}
                    </div>
                )}
                {filteredDependencyGraph.unused.map((assetUrl) => {
                    const isMoving = movingAssetUrl === assetUrl;
                    return (
                        <div key={`unused-${assetUrl}`} style={unusedRowStyle(uiScale, selectedUnusedAssetSet.has(assetUrl))}>
                            <label style={{ alignItems: 'center', display: 'flex', flex: 1, gap: `${6 * uiScale}px`, minWidth: 0 }}>
                                <input
                                    checked={selectedUnusedAssetSet.has(assetUrl)}
                                    onChange={(event) => {
                                        const checked = event.currentTarget.checked;
                                        setSelectedUnusedAssets((current) => toggleUnusedAssetSelection(current, assetUrl, checked));
                                    }}
                                    type="checkbox"
                                />
                                <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{assetUrl}</span>
                            </label>
                            <button
                                className="toolbar-btn"
                                disabled={!!movingAssetUrl}
                                onClick={() => {
                                    void handleMoveAsset(projectPath, assetUrl, setMovingAssetUrl);
                                }}
                                style={miniButtonStyle(uiScale, !!movingAssetUrl)}
                                title={`Move ${assetUrl}`}
                                type="button"
                            >
                                <FolderInput size={13 * uiScale} />
                                <span>{isMoving ? 'Moving...' : 'Move...'}</span>
                            </button>
                        </div>
                    );
                })}
            </section>

            <section style={sectionStyle(uiScale)}>
                <div style={sectionHeaderStyle(uiScale)}>Missing referenced assets</div>
                {filteredDependencyGraph.missing.length === 0 && (
                    <div style={{ color: t.text.faint, fontStyle: 'italic' }}>
                        {isFilteringAssets ? 'No missing assets match the current filter.' : 'No missing assets referenced.'}
                    </div>
                )}
                {filteredDependencyGraph.missing.map((entry) => (
                    <EntryBlock
                        key={`missing-${entry.assetUrl}`}
                        locations={entry.references}
                        name={entry.assetUrl}
                        onOpenLocation={handleOpenLocation}
                        subtitle={`missing | references: ${entry.references.length}`}
                        uiScale={uiScale}
                    />
                ))}
            </section>

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
                    void (async () => {
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
                    })();
                }}
                open={showDeleteUnusedDialog}
                title="Delete unused assets?"
            />
        </div>
    );
}

function actionButtonStyle(uiScale: number, disabled: boolean, emphasized = false) {
    return {
        alignItems: 'center',
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: disabled ? t.text.faint : (emphasized ? t.text.primary : t.text.normal),
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        gap: `${6 * uiScale}px`,
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
        textAlign: 'left' as const,
    };
}

function basename(path: string): string {
    return path.split(/[\\/]/).pop() || path;
}

function EntryBlock({
    locations,
    moveDisabled = false,
    moving = false,
    name,
    onMoveAsset,
    onOpenLocation,
    subtitle,
    uiScale,
}: {
    locations: ReferenceLocation[];
    moveDisabled?: boolean;
    moving?: boolean;
    name: string;
    onMoveAsset?: (assetUrl: string) => void;
    onOpenLocation: (location: ReferenceLocation) => Promise<void>;
    subtitle: string;
    uiScale: number;
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div style={{ border: `1px solid ${t.border.subtle}`, borderRadius: t.radius.sm, padding: `${6 * uiScale}px` }}>
            <div style={{ alignItems: 'flex-start', display: 'flex', gap: `${6 * uiScale}px` }}>
                <button className="toolbar-btn" onClick={() => setExpanded((value) => !value)} style={entryHeaderStyle(uiScale)} type="button">
                    <span style={{ color: t.text.primary, fontWeight: 600 }}>{name}</span>
                    <span style={{ color: t.text.faint }}>{subtitle}</span>
                </button>
                {onMoveAsset ? (
                    <button
                        className="toolbar-btn"
                        disabled={moveDisabled}
                        onClick={() => onMoveAsset(name)}
                        style={miniButtonStyle(uiScale, moveDisabled)}
                        title={`Move ${name}`}
                        type="button"
                    >
                        <FolderInput size={13 * uiScale} />
                        <span>{moving ? 'Moving...' : 'Move...'}</span>
                    </button>
                ) : undefined}
            </div>

            {expanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: `${4 * uiScale}px`, marginTop: `${4 * uiScale}px` }}>
                    {locations.map((location, index) => (
                        <LocationRow
                            key={`${name}-${index}`}
                            location={location}
                            onOpenLocation={onOpenLocation}
                            uiScale={uiScale}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function entryHeaderStyle(uiScale: number) {
    return {
        alignItems: 'flex-start',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: `${2 * uiScale}px`,
        width: '100%',
    };
}

function folderGroupButtonStyle(uiScale: number, selected: boolean) {
    return {
        alignItems: 'center',
        background: selected ? t.bg.selected : t.bg.panel,
        border: `1px solid ${selected ? t.accent.primary : t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: t.text.normal,
        cursor: 'pointer',
        display: 'flex',
        fontSize: `${11 * uiScale}px`,
        gap: `${5 * uiScale}px`,
        minWidth: 0,
        padding: `${4 * uiScale}px ${6 * uiScale}px`,
    };
}

function folderGroupGridStyle(uiScale: number) {
    return {
        display: 'grid',
        gap: `${5 * uiScale}px`,
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    };
}

function formatAssetKind(kind: string): string {
    return kind.slice(0, 1).toUpperCase() + kind.slice(1);
}

function formatFilteredCount(visibleCount: number, totalCount: number, isFiltering: boolean): string {
    return isFiltering ? `${visibleCount}/${totalCount}` : String(totalCount);
}

async function handleImportAssets(
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

async function handleMoveAsset(
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

async function handleOpenLocation(location: ReferenceLocation) {
    await openProjectEntry(location.filePath, basename(location.filePath), { forceView: 'timeline' });
    const editor = useEditorStore.getState();
    editor.setSelectedNodePaths([location.path]);
    editor.setSelectionAnchorPath(location.path);
}

function kindSummaryChipStyle(uiScale: number, selected: boolean) {
    return {
        background: selected ? t.bg.selected : t.bg.panel,
        border: `1px solid ${selected ? t.accent.primary : t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: t.text.normal,
        cursor: 'pointer',
        fontSize: `${11 * uiScale}px`,
        padding: `${3 * uiScale}px ${6 * uiScale}px`,
        whiteSpace: 'nowrap' as const,
    };
}

function kindSummaryRowStyle(uiScale: number) {
    return {
        display: 'flex',
        flexWrap: 'wrap' as const,
        gap: `${5 * uiScale}px`,
    };
}

function LocationRow({
    location,
    onOpenLocation,
    uiScale,
}: {
    location: ReferenceLocation;
    onOpenLocation: (location: ReferenceLocation) => Promise<void>;
    uiScale: number;
}) {
    return (
        <button
            className="toolbar-btn"
            onClick={() => {
                void onOpenLocation(location);
            }}
            style={{
                alignItems: 'flex-start',
                border: `1px solid ${t.border.subtle}`,
                borderRadius: t.radius.sm,
                display: 'flex',
                flexDirection: 'column',
                fontSize: `${11 * uiScale}px`,
                gap: `${2 * uiScale}px`,
                padding: `${5 * uiScale}px ${6 * uiScale}px`,
                textAlign: 'left',
                width: '100%',
            }}
            type="button"
        >
            <span style={{ color: t.text.normal }}>{location.sceneName}</span>
            <span style={{ color: t.text.faint }}>{basename(location.filePath)} - {location.commandType}</span>
            <span style={{ color: t.text.faint }}>Path: {location.path.join('.')}</span>
        </button>
    );
}

function miniButtonStyle(uiScale: number, disabled: boolean) {
    return {
        alignItems: 'center',
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: disabled ? t.text.faint : t.text.normal,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        fontSize: `${11 * uiScale}px`,
        gap: `${4 * uiScale}px`,
        padding: `${4 * uiScale}px ${6 * uiScale}px`,
        whiteSpace: 'nowrap' as const,
    };
}

function searchBoxStyle(uiScale: number) {
    return {
        alignItems: 'center',
        background: t.bg.panel,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: t.text.muted,
        display: 'flex',
        gap: `${6 * uiScale}px`,
        padding: `${5 * uiScale}px ${7 * uiScale}px`,
    };
}

function searchInputStyle(uiScale: number) {
    return {
        background: 'transparent',
        border: 'none',
        color: t.text.normal,
        flex: 1,
        fontSize: `${12 * uiScale}px`,
        minWidth: 0,
        outline: 'none',
    };
}

function sectionHeaderStyle(uiScale: number) {
    return {
        color: t.text.primary,
        fontWeight: 700,
        padding: `${2 * uiScale}px 0`,
    };
}

function sectionStyle(uiScale: number) {
    return {
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.md,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: `${6 * uiScale}px`,
        padding: `${8 * uiScale}px`,
    };
}

function sectionTitleRowStyle(uiScale: number) {
    return {
        alignItems: 'center',
        display: 'flex',
        gap: `${8 * uiScale}px`,
        justifyContent: 'space-between',
    };
}

function unusedRowStyle(uiScale: number, selected: boolean) {
    return {
        alignItems: 'center',
        background: selected ? t.bg.selected : t.bg.panel,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: t.text.normal,
        display: 'flex',
        fontSize: `${12 * uiScale}px`,
        gap: `${6 * uiScale}px`,
        justifyContent: 'space-between',
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
    };
}

