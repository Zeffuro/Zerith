import { useMemo, useState } from 'react';

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

export function AssetDependencyPanel() {
    const uiScale = useSettingsStore((state) => state.uiScale);
    const projectPath = useProjectStore((state) => state.projectPath);
    const result = useReferenceStore((state) => state.result);
    const assetInventory = useReferenceStore((state) => state.assetInventory);

    const [isDeletingUnused, setIsDeletingUnused] = useState(false);
    const [showDeleteUnusedDialog, setShowDeleteUnusedDialog] = useState(false);

    const dependencyGraph = useMemo(
        () => createAssetDependencyGraph(result.assetFiles, assetInventory),
        [assetInventory, result.assetFiles],
    );

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
                disabled={dependencyGraph.unused.length === 0 || isDeletingUnused}
                onClick={() => setShowDeleteUnusedDialog(true)}
                style={{
                    border: `1px solid ${t.border.subtle}`,
                    borderRadius: t.radius.sm,
                    color: dependencyGraph.unused.length === 0 ? t.text.faint : t.text.primary,
                    cursor: dependencyGraph.unused.length === 0 || isDeletingUnused ? 'not-allowed' : 'pointer',
                    padding: `${6 * uiScale}px ${8 * uiScale}px`,
                    textAlign: 'left',
                }}
                type="button"
            >
                {isDeletingUnused ? 'Deleting unused assets...' : `Delete unused assets (${dependencyGraph.unused.length})`}
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
                <div style={sectionHeaderStyle(uiScale)}>Unused assets</div>
                {dependencyGraph.unused.length === 0 && (
                    <div style={{ color: t.text.faint, fontStyle: 'italic' }}>No unused assets detected.</div>
                )}
                {dependencyGraph.unused.map((assetUrl) => (
                    <div key={`unused-${assetUrl}`} style={unusedRowStyle(uiScale)}>{assetUrl}</div>
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
                message={`Delete ${dependencyGraph.unused.length} unused assets? This cannot be undone.`}
                onCancel={() => {
                    if (isDeletingUnused) return;
                    setShowDeleteUnusedDialog(false);
                }}
                onConfirm={() => {
                    void (async () => {
                        setIsDeletingUnused(true);
                        try {
                            const filePaths = await Promise.all(
                                dependencyGraph.unused.map((assetUrl) => {
                                    const normalizedAsset = assetUrl.replace(/^\/+/, '');
                                    return fsJoin(projectPath, normalizedAsset);
                                }),
                            );
                            await deletePaths(filePaths);
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

function unusedRowStyle(uiScale: number) {
    return {
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: t.text.normal,
        fontSize: `${12 * uiScale}px`,
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
    };
}

