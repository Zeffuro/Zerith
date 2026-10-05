import { AlertTriangle, CheckCircle2, Download, ExternalLink, Languages, ListFilter, Plus, Save, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type {
    LocalizationPanelRowIssueSeverity,
    LocalizationPanelRowLocation,
    LocalizationPanelRowStatus,
} from './localizationPanelModel';

import { openProjectEntry } from '../../services/openProjectEntry';
import { useProjectStore } from '../../store/storeBootstrap';
import { useEditorStore } from '../../store/useEditorStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { ConfirmDialog } from '../ConfirmDialog';
import { DOCK_PANELS } from '../layout/dock/dockPanelIds';
import {
    buildLocalizationPanelRows,
    createLocalizationPanelSummary,
    filterLocalizationPanelRows,
    toLocalizationEntryKey,
} from './localizationPanelModel';
import {
    actionButtonStyle,
    basename,
    comparisonColumnStyle,
    comparisonGridStyle,
    comparisonLabelStyle,
    EmptyPanelMessage,
    filterLabelStyle,
    filterRowStyle,
    formatLocalizationRowKind,
    headerStyle,
    iconButtonStyle,
    inputStyle,
    locationButtonStyle,
    locationListStyle,
    panelStyle,
    rowHeaderStyle,
    rowStyle,
    saveRowStyle,
    sourceTextStyle,
    statusBadgeStyle,
    statusStyle,
    SummaryChip,
    summaryGridStyle,
    textareaStyle,
    toolbarGridStyle,
} from './LocalizationPanelPresentation';
import { useLocalizationDraft } from './useLocalizationDraft';

export function LocalizationPanel({
    initialLocale,
    initialNamespace,
    initialQuery,
    initialStatus,
}: {
    initialLocale?: string;
    initialNamespace?: string;
    initialQuery?: string;
    initialStatus?: string;
} = {}) {
    const locales = useProjectStore((state) => state.locales);
    const manifest = useProjectStore((state) => state.manifest);
    const projectPath = useProjectStore((state) => state.projectPath);
    const sceneNamespaces = useProjectStore((state) => state.sceneNamespaces);
    const scenePaths = useProjectStore((state) => state.scenePaths);
    const scenes = useProjectStore((state) => state.scenes);
    const previewLocale = useEditorStore((state) => state.previewLocale);
    const setPreviewLocale = useEditorStore((state) => state.setPreviewLocale);
    const uiScale = useEditorStore((state) => state.uiScale);

    const localeIds = useMemo(
        () => Object.keys(locales).toSorted((left, right) => left.localeCompare(right)),
        [locales],
    );
    const [issueSeverityFilter, setIssueSeverityFilter] = useState<'all' | LocalizationPanelRowIssueSeverity>('all');
    const [namespaceFilter, setNamespaceFilter] = useState('all');
    const [newLocale, setNewLocale] = useState('');
    const [query, setQuery] = useState(initialQuery ?? '');
    const [rowStatusFilter, setRowStatusFilter] = useState<'all' | LocalizationPanelRowStatus>('all');
    const [selectedLocale, setSelectedLocale] = useState<string>('');
    const [showPruneUnusedDialog, setShowPruneUnusedDialog] = useState(false);
    const draft = useLocalizationDraft(selectedLocale);
    const { busy, dirtyEntryCount, draftValues, handleDraftChange, handleSave, ready, selectedBundle, status } = draft;

    useEffect(() => {
        if (initialLocale) setSelectedLocale(initialLocale);
    }, [initialLocale, projectPath]);

    useEffect(() => {
        if (selectedLocale && localeIds.includes(selectedLocale)) return;
        if (initialLocale && localeIds.includes(initialLocale)) {
            setSelectedLocale(initialLocale);
            return;
        }
        if (previewLocale && localeIds.includes(previewLocale)) {
            setSelectedLocale(previewLocale);
            return;
        }
        const defaultLocale = manifest?.localization?.defaultLocale;
        if (defaultLocale && localeIds.includes(defaultLocale)) {
            setSelectedLocale(defaultLocale);
            return;
        }
        setSelectedLocale(localeIds[0] ?? '');
    }, [initialLocale, localeIds, manifest?.localization?.defaultLocale, previewLocale, selectedLocale]);

    useEffect(() => {
        setShowPruneUnusedDialog(false);
    }, [projectPath, selectedLocale]);

    useEffect(() => {
        if (initialQuery === undefined) return;
        setQuery(initialQuery);
    }, [initialQuery]);

    useEffect(() => {
        if (!initialNamespace) return;
        setNamespaceFilter(initialNamespace);
    }, [initialNamespace]);

    useEffect(() => {
        const status = parseInitialLocalizationStatus(initialStatus);
        if (!status) return;
        setRowStatusFilter(status);
    }, [initialStatus]);

    const rows = useMemo(
        () => buildLocalizationPanelRows({ sceneNamespaces, scenePaths, scenes }, selectedBundle),
        [sceneNamespaces, scenePaths, scenes, selectedBundle],
    );
    const summary = useMemo(() => createLocalizationPanelSummary(rows), [rows]);
    const filteredRows = useMemo(
        () => filterLocalizationPanelRows(rows, {
            issueSeverity: issueSeverityFilter,
            namespace: namespaceFilter,
            query,
            status: rowStatusFilter,
        }),
        [issueSeverityFilter, namespaceFilter, query, rowStatusFilter, rows],
    );
    const visibleMissingCount = filteredRows.filter((row) => row.status === 'missing').length;
    const visibleUnusedCount = filteredRows.filter((row) => row.status === 'unused').length;

    useEffect(() => {
        if (namespaceFilter === 'all' || summary.namespaces.includes(namespaceFilter)) return;
        setNamespaceFilter('all');
    }, [namespaceFilter, summary.namespaces]);

    const handleAddLocale = async () => {
        const locale = newLocale.trim();
        if (!locale) return;
        if (locales[locale]) {
            setSelectedLocale(locale);
            setNewLocale('');
            return;
        }
        const sourceRows = buildLocalizationPanelRows({ sceneNamespaces, scenePaths, scenes });
        await draft.handleAddLocale(locale, sourceRows, () => {
            setNewLocale('');
            setPreviewLocale(locale);
            setSelectedLocale(locale);
        });
    };

    if (!projectPath) {
        return <EmptyPanelMessage message="Open a project to edit locale strings." uiScale={uiScale} />;
    }

    return (
        <div className="zerith-scrollbar" style={panelStyle(uiScale)}>
            <div style={headerStyle(uiScale)}>
                <strong>Localization</strong>
                <button
                    className="toolbar-btn"
                    disabled={!selectedLocale}
                    onClick={() => selectedLocale && setPreviewLocale(selectedLocale)}
                    style={actionButtonStyle(uiScale, !selectedLocale)}
                    title="Use selected locale in preview"
                    type="button"
                >
                    <Languages size={14 * uiScale} />
                    <span>{previewLocale === selectedLocale ? 'Previewing' : 'Use in Preview'}</span>
                </button>
            </div>

            <div style={toolbarGridStyle(uiScale)}>
                <select
                    aria-label="Localization locale"
                    disabled={localeIds.length === 0}
                    onChange={(event) => setSelectedLocale(event.currentTarget.value)}
                    style={inputStyle(uiScale)}
                    value={selectedLocale}
                >
                    {localeIds.length === 0 ? <option value="">No locales</option> : undefined}
                    {localeIds.map((locale) => (
                        <option key={locale} value={locale}>{locale}</option>
                    ))}
                </select>
                <input
                    onChange={(event) => setNewLocale(event.currentTarget.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') void handleAddLocale();
                    }}
                    placeholder="New locale"
                    style={inputStyle(uiScale)}
                    value={newLocale}
                />
                <button className="toolbar-btn" disabled={busy} onClick={() => void handleAddLocale()} style={iconButtonStyle(uiScale)} title="Add locale" type="button">
                    <Plus size={14 * uiScale} />
                </button>
            </div>

            <div style={summaryGridStyle(uiScale)}>
                <SummaryChip label="Lines" uiScale={uiScale} value={summary.total} />
                <SummaryChip label="Missing" tone={summary.missing > 0 ? 'bad' : 'good'} uiScale={uiScale} value={summary.missing} />
                <SummaryChip label="Unused" tone={summary.unused > 0 ? 'warn' : undefined} uiScale={uiScale} value={summary.unused} />
                <SummaryChip label="Same" tone={summary.same > 0 ? 'warn' : undefined} uiScale={uiScale} value={summary.same} />
                <SummaryChip label="Translated" uiScale={uiScale} value={summary.translated} />
                <SummaryChip label="Unsaved" tone={dirtyEntryCount > 0 ? 'warn' : undefined} uiScale={uiScale} value={dirtyEntryCount} />
            </div>

            {status ? (
                <div style={statusStyle(status.kind, uiScale)}>
                    {status.kind === 'ok' ? <CheckCircle2 size={14 * uiScale} /> : <AlertTriangle size={14 * uiScale} />}
                    <span>{status.text}</span>
                </div>
            ) : undefined}

            <div style={filterRowStyle(uiScale)}>
                <span style={filterLabelStyle(uiScale)}>
                    <ListFilter size={13 * uiScale} />
                    <span>Filters</span>
                </span>
                <select
                    aria-label="Localization row status filter"
                    onChange={(event) => setRowStatusFilter(event.currentTarget.value as 'all' | LocalizationPanelRowStatus)}
                    style={inputStyle(uiScale)}
                    value={rowStatusFilter}
                >
                    <option value="all">All rows</option>
                    <option value="missing">Missing only</option>
                    <option value="unused">Unused only</option>
                    <option value="same">Same as source</option>
                    <option value="translated">Translated only</option>
                </select>
                <select
                    aria-label="Localization namespace filter"
                    onChange={(event) => setNamespaceFilter(event.currentTarget.value)}
                    style={inputStyle(uiScale)}
                    value={namespaceFilter}
                >
                    <option value="all">All namespaces</option>
                    {summary.namespaces.map((namespace) => (
                        <option key={namespace} value={namespace}>{namespace}</option>
                    ))}
                </select>
                <select
                    aria-label="Localization issue severity filter"
                    onChange={(event) => setIssueSeverityFilter(event.currentTarget.value as 'all' | LocalizationPanelRowIssueSeverity)}
                    style={inputStyle(uiScale)}
                    value={issueSeverityFilter}
                >
                    <option value="all">All severities</option>
                    <option value="error">Errors</option>
                    <option value="warning">Warnings</option>
                    <option value="none">No issues</option>
                </select>
            </div>

            <div style={saveRowStyle(uiScale)}>
                <input
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Filter line IDs or text..."
                    style={{ ...inputStyle(uiScale), flex: '1 1 220px' }}
                    value={query}
                />
                <button
                    className="toolbar-btn"
                    disabled={busy || !ready || visibleMissingCount === 0 || !selectedLocale}
                    onClick={() => draft.handleFillMissing(filteredRows)}
                    style={actionButtonStyle(uiScale, visibleMissingCount === 0 || !selectedLocale)}
                    title="Create visible missing locale entries from source text"
                    type="button"
                >
                    <Plus size={14 * uiScale} />
                    <span>Fill Missing ({visibleMissingCount})</span>
                </button>
                <button
                    className="toolbar-btn"
                    disabled={busy || !ready || visibleUnusedCount === 0 || !selectedBundle}
                    onClick={() => setShowPruneUnusedDialog(true)}
                    style={actionButtonStyle(uiScale, visibleUnusedCount === 0 || !selectedBundle)}
                    title="Prune visible unused locale entries"
                    type="button"
                >
                    <Trash2 size={14 * uiScale} />
                    <span>Prune Unused ({visibleUnusedCount})</span>
                </button>
                <button
                    className="toolbar-btn"
                    disabled={filteredRows.length === 0 || !selectedLocale}
                    onClick={() => {
                        void draft.handleExport(filteredRows);
                    }}
                    style={actionButtonStyle(uiScale, filteredRows.length === 0 || !selectedLocale)}
                    title="Export visible localization rows for translator round trip"
                    type="button"
                >
                    <Download size={14 * uiScale} />
                    <span>Export Visible</span>
                </button>
                <button
                    className="toolbar-btn"
                    disabled={busy || !ready || !selectedLocale}
                    onClick={() => {
                        void draft.handleImport();
                    }}
                    style={actionButtonStyle(uiScale, !selectedLocale)}
                    title="Import translator JSON into unsaved locale drafts"
                    type="button"
                >
                    <Upload size={14 * uiScale} />
                    <span>Import Drafts</span>
                </button>
                <button
                    className="toolbar-btn primary"
                    disabled={busy || !ready || dirtyEntryCount === 0 || !selectedLocale}
                    onClick={() => void handleSave()}
                    style={actionButtonStyle(uiScale, dirtyEntryCount === 0 || !selectedLocale)}
                    title="Save locale"
                    type="button"
                >
                    <Save size={14 * uiScale} />
                    <span>Save Locale</span>
                </button>
            </div>

            {localeIds.length === 0 ? (
                <div style={{ color: t.text.faint, fontStyle: 'italic' }}>No locale bundle is registered in this project.</div>
            ) : undefined}

            {filteredRows.map((row) => {
                const key = toLocalizationEntryKey(row.namespace, row.lineId);
                const draftValue = draftValues[key] ?? row.value;
                return (
                    <div key={key} style={rowStyle(uiScale)}>
                        <div style={rowHeaderStyle(uiScale)}>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ color: t.text.primary, fontWeight: 700, overflowWrap: 'anywhere' }}>{row.lineId}</div>
                                <div style={{ color: t.text.faint, fontSize: `${11 * uiScale}px`, overflowWrap: 'anywhere' }}>
                                    {row.namespace} - {formatLocalizationRowKind(row.kind)}
                                </div>
                            </div>
                            <span style={statusBadgeStyle(row.status, uiScale)}>{row.status}</span>
                        </div>
                        <div style={comparisonGridStyle(uiScale)}>
                            <div style={comparisonColumnStyle(uiScale)}>
                                <span style={comparisonLabelStyle(uiScale)}>Source</span>
                                <div style={sourceTextStyle(uiScale)}>
                                    {row.status === 'unused' ? 'Unused locale entry; no matching source line was found.' : row.sourceText}
                                </div>
                            </div>
                            <div style={comparisonColumnStyle(uiScale)}>
                                <span style={comparisonLabelStyle(uiScale)}>{selectedLocale || 'Locale'}</span>
                                <div style={sourceTextStyle(uiScale)}>
                                    {draftValue || 'Missing locale entry'}
                                </div>
                            </div>
                        </div>
                        <textarea
                            aria-label={`Translation ${key}`}
                            disabled={!ready}
                            onChange={(event) => handleDraftChange(key, event.currentTarget.value)}
                            rows={3}
                            style={textareaStyle(uiScale, key in draftValues)}
                            value={draftValue}
                        />
                        <div style={locationListStyle(uiScale)}>
                            {row.locations.slice(0, 3).map((location, index) => (
                                <button
                                    className="toolbar-btn"
                                    key={`${key}-${location.sceneName}-${index}`}
                                    onClick={() => void openSourceLocation(location)}
                                    style={locationButtonStyle(uiScale)}
                                    title="Open source command"
                                    type="button"
                                >
                                    <ExternalLink size={12 * uiScale} />
                                    <span>{location.sceneName} @ {location.path.join('.')}</span>
                                </button>
                            ))}
                            {row.locations.length > 3 ? (
                                <span style={{ color: t.text.faint, fontSize: `${11 * uiScale}px` }}>+{row.locations.length - 3} more</span>
                            ) : undefined}
                        </div>
                    </div>
                );
            })}

            <ConfirmDialog
                cancelText="Cancel"
                confirmText="Prune"
                danger
                message={`Remove ${visibleUnusedCount} visible unused locale entr${visibleUnusedCount === 1 ? 'y' : 'ies'} from ${selectedLocale}? This updates the locale JSON file.`}
                onCancel={() => setShowPruneUnusedDialog(false)}
                onConfirm={() => {
                    void draft.handlePrune(filteredRows).then(() => setShowPruneUnusedDialog(false));
                }}
                open={showPruneUnusedDialog}
                title="Prune unused locale entries?"
            />
        </div>
    );
}

async function openSourceLocation(location: LocalizationPanelRowLocation): Promise<void> {
    if (!location.sourcePath) return;

    await openProjectEntry(location.sourcePath, basename(location.sourcePath), { forceView: 'timeline' });
    const editor = useEditorStore.getState();
    editor.setSelectedNodePaths([location.path]);
    editor.setSelectionAnchorPath(location.path);

    if (typeof globalThis.dispatchEvent === 'function' && typeof globalThis.CustomEvent === 'function') {
        globalThis.dispatchEvent(new globalThis.CustomEvent('zerith:dock-select', { detail: DOCK_PANELS.editor }));
    }
}

function parseInitialLocalizationStatus(status: string | undefined): 'all' | LocalizationPanelRowStatus | undefined {
    switch (status) {
        case 'all':
        case 'missing':
        case 'same':
        case 'translated':
        case 'unused': {
            return status;
        }
        default: {
            return undefined;
        }
    }
}
