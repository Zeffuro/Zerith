import { CheckSquare, Square, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { ReferenceLocation } from '../../services/referenceScanner';

import { deletePaths } from '../../services/explorerFileActions';
import { fsJoin } from '../../services/fs';
import { openProjectEntry } from '../../services/openProjectEntry';
import { createAssetDependencyGraph } from '../../services/referenceScanner';
import { useProjectStore } from '../../store/storeBootstrap';
import { useEditorStore } from '../../store/useEditorStore';
import { useReferenceStore } from '../../store/useReferenceStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { ConfirmDialog } from '../ConfirmDialog';
import {
    areAllUnusedAssetsSelected,
    getSelectedUnusedAssets,
    reconcileUnusedAssetSelection,
    toggleUnusedAssetSelection,
} from './assetDependencyPanelModel';

export function AssetDependencyPanel() {
    const uiScale = useSettingsStore((state) => state.uiScale);
    const projectPath = useProjectStore((state) => state.projectPath);
    const result = useReferenceStore((state) => state.result);
    const assetInventory = useReferenceStore((state) => state.assetInventory);

    const [isDeletingUnused, setIsDeletingUnused] = useState(false);
    const [selectedUnusedAssets, setSelectedUnusedAssets] = useState<string[]>([]);
    const [showDeleteUnusedDialog, setShowDeleteUnusedDialog] = useState(false);

    const dependencyGraph = useMemo(
        () => createAssetDependencyGraph(result.assetFiles, assetInventory),
        [assetInventory, result.assetFiles],
    );
    const selectedUnusedAssetUrls = useMemo(
        () => getSelectedUnusedAssets(selectedUnusedAssets, dependencyGraph.unused),
        [dependencyGraph.unused, selectedUnusedAssets],
    );
    const selectedUnusedAssetSet = useMemo(() => new Set(selectedUnusedAssetUrls), [selectedUnusedAssetUrls]);
    const allUnusedAssetsSelected = areAllUnusedAssetsSelected(selectedUnusedAssetUrls, dependencyGraph.unused);

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
                Used: {dependencyGraph.used.length} | Unused: {dependencyGraph.unused.length} | Missing: {dependencyGraph.missing.length}
            </div>

            <button
                className="toolbar-btn"
                disabled={selectedUnusedAssetUrls.length === 0 || isDeletingUnused}
                onClick={() => setShowDeleteUnusedDialog(true)}
                style={{
                    alignItems: 'center',
                    border: `1px solid ${t.border.subtle}`,
                    borderRadius: t.radius.sm,
                    color: selectedUnusedAssetUrls.length === 0 ? t.text.faint : t.text.primary,
                    cursor: selectedUnusedAssetUrls.length === 0 || isDeletingUnused ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    gap: `${6 * uiScale}px`,
                    padding: `${6 * uiScale}px ${8 * uiScale}px`,
                    textAlign: 'left',
                }}
                type="button"
            >
                <Trash2 size={14 * uiScale} />
                <span>{isDeletingUnused ? 'Deleting unused assets...' : `Delete selected unused assets (${selectedUnusedAssetUrls.length})`}</span>
            </button>

            <section style={sectionStyle(uiScale)}>
                <div style={sectionHeaderStyle(uiScale)}>Used assets</div>
                {dependencyGraph.used.length === 0 && (
                    <div style={{ color: t.text.faint, fontStyle: 'italic' }}>No asset references found in scripts/macros.</div>
                )}
                {dependencyGraph.used.map((entry) => (
                    <EntryBlock
                        key={`used-${entry.assetUrl}`}
                        locations={entry.references}
                        name={entry.assetUrl}
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
                            disabled={dependencyGraph.unused.length === 0 || allUnusedAssetsSelected}
                            onClick={() => setSelectedUnusedAssets([...dependencyGraph.unused])}
                            style={miniButtonStyle(uiScale, dependencyGraph.unused.length === 0 || allUnusedAssetsSelected)}
                            title="Select all unused assets"
                            type="button"
                        >
                            <CheckSquare size={13 * uiScale} />
                            <span>Select all</span>
                        </button>
                        <button
                            className="toolbar-btn"
                            disabled={selectedUnusedAssetUrls.length === 0}
                            onClick={() => setSelectedUnusedAssets([])}
                            style={miniButtonStyle(uiScale, selectedUnusedAssetUrls.length === 0)}
                            title="Clear unused asset selection"
                            type="button"
                        >
                            <Square size={13 * uiScale} />
                            <span>Clear</span>
                        </button>
                    </div>
                </div>
                <div style={{ color: t.text.faint, fontSize: `${11 * uiScale}px` }}>
                    Selected for cleanup: {selectedUnusedAssetUrls.length}
                </div>
                {dependencyGraph.unused.length === 0 && (
                    <div style={{ color: t.text.faint, fontStyle: 'italic' }}>No unused assets detected.</div>
                )}
                {dependencyGraph.unused.map((assetUrl) => (
                    <label key={`unused-${assetUrl}`} style={unusedRowStyle(uiScale, selectedUnusedAssetSet.has(assetUrl))}>
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
                ))}
            </section>

            <section style={sectionStyle(uiScale)}>
                <div style={sectionHeaderStyle(uiScale)}>Missing referenced assets</div>
                {dependencyGraph.missing.length === 0 && (
                    <div style={{ color: t.text.faint, fontStyle: 'italic' }}>No missing assets referenced.</div>
                )}
                {dependencyGraph.missing.map((entry) => (
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

function basename(path: string): string {
    return path.split(/[\\/]/).pop() || path;
}

function EntryBlock({
    locations,
    name,
    onOpenLocation,
    subtitle,
    uiScale,
}: {
    locations: ReferenceLocation[];
    name: string;
    onOpenLocation: (location: ReferenceLocation) => Promise<void>;
    subtitle: string;
    uiScale: number;
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div style={{ border: `1px solid ${t.border.subtle}`, borderRadius: t.radius.sm, padding: `${6 * uiScale}px` }}>
            <button className="toolbar-btn" onClick={() => setExpanded((value) => !value)} style={entryHeaderStyle(uiScale)} type="button">
                <span style={{ color: t.text.primary, fontWeight: 600 }}>{name}</span>
                <span style={{ color: t.text.faint }}>{subtitle}</span>
            </button>

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

async function handleOpenLocation(location: ReferenceLocation) {
    await openProjectEntry(location.filePath, basename(location.filePath), { forceView: 'timeline' });
    const editor = useEditorStore.getState();
    editor.setSelectedNodePaths([location.path]);
    editor.setSelectionAnchorPath(location.path);
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
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
    };
}

