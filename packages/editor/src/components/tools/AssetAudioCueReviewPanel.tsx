import { AlertTriangle, CheckCircle2, Download, ExternalLink, Tags } from 'lucide-react';
import { useEffect, useState } from 'react';

import type {
    AssetAudioCueReview,
    AssetAudioCueReviewFilter,
} from '../../services/assetAudioCueReview';

import { exportAssetAudioCuesToProject } from '../../services/assetAudioCueExport';
import {
    collectAssetAudioCueOrganizationAssetUrls,
    createAssetAudioCueExportReadiness,
    createAssetAudioCueReviewSummary,
    filterAssetAudioCueReviewEntries,
    isAssetAudioCueReviewEntryExportable,
    loadAssetAudioCueReview,
    searchAssetAudioCueReviewEntries,
} from '../../services/assetAudioCueReview';
import { refreshProjectTree } from '../../services/explorerFileActions';
import { refreshReferenceScannerState } from '../../services/referenceScanner';
import { editorTheme as t } from '../../theme/editorTheme';
import {
    kindSummaryChipStyle,
    kindSummaryRowStyle,
    miniButtonStyle,
    searchInputStyle,
    sectionHeaderStyle,
    sectionStyle,
    sectionTitleRowStyle,
} from './assetDependencyPanelStyles';

type Properties = {
    assetInventory: string[];
    assetUrls: string[];
    onOpenAsset: (assetUrl: string) => void;
    onOpenSourceAsset?: (assetUrl: string) => void;
    onOrganizeCueAssets?: (assetUrls: string[]) => void;
    projectPath: string;
    uiScale: number;
};

export function AssetAudioCueReviewPanel({
    assetInventory,
    assetUrls,
    onOpenAsset,
    onOpenSourceAsset,
    onOrganizeCueAssets,
    projectPath,
    uiScale,
}: Properties) {
    const [review, setReview] = useState<AssetAudioCueReview>({ entries: [], issueCount: 0, totalCues: 0 });
    const [exportMessage, setExportMessage] = useState<string>();
    const [exportingTarget, setExportingTarget] = useState<string>();
    const [cueSearchQuery, setCueSearchQuery] = useState('');
    const [reviewFilter, setReviewFilter] = useState<AssetAudioCueReviewFilter>('all');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        void loadAssetAudioCueReview(projectPath, assetUrls, assetInventory)
            .then((nextReview) => {
                if (!cancelled) setReview(nextReview);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [assetInventory, assetUrls, projectPath]);

    const exportCueSheet = async (descriptorAssetUrl: string, refreshAfterExport: boolean): Promise<number> => {
        const result = await exportAssetAudioCuesToProject(projectPath, {
            descriptorAssetUrl,
            namePreset: 'region-name-time',
            targetFolder: 'assets/audio-regions',
        });
        if (refreshAfterExport && result.exportedCount > 0) {
            await refreshProjectTree();
            await refreshReferenceScannerState();
        }
        return result.exportedCount;
    };

    const exportOne = async (descriptorAssetUrl: string) => {
        setExportingTarget(descriptorAssetUrl);
        setExportMessage(undefined);
        try {
            const exportedCount = await exportCueSheet(descriptorAssetUrl, true);
            setExportMessage(`Saved ${exportedCount} cue WAV${exportedCount === 1 ? '' : 's'} to assets/audio-regions.`);
        } catch (error) {
            setExportMessage(error instanceof Error ? error.message : 'Failed to export cues.');
        } finally {
            setExportingTarget(undefined);
        }
    };

    const exportVisible = async () => {
        const exportableEntries = visibleEntries.filter(isAssetAudioCueReviewEntryExportable);
        if (exportableEntries.length === 0) {
            setExportMessage('No visible cue sheets can be exported.');
            return;
        }

        setExportingTarget('visible');
        setExportMessage(undefined);
        let exportedCount = 0;
        let failedCount = 0;

        try {
            for (const entry of exportableEntries) {
                try {
                    exportedCount += await exportCueSheet(entry.descriptorAssetUrl, false);
                } catch (error) {
                    console.error('Failed to export audiosheet cues:', entry.descriptorAssetUrl, error);
                    failedCount += 1;
                }
            }

            if (exportedCount > 0) {
                await refreshProjectTree();
                await refreshReferenceScannerState();
            }
            setExportMessage([
                `Saved ${exportedCount} cue WAV${exportedCount === 1 ? '' : 's'} from ${exportableEntries.length - failedCount} sheet${exportableEntries.length - failedCount === 1 ? '' : 's'}.`,
                failedCount > 0 ? `${failedCount} sheet${failedCount === 1 ? '' : 's'} failed.` : undefined,
            ].filter(Boolean).join(' '));
        } catch (error) {
            setExportMessage(error instanceof Error ? error.message : 'Failed to export visible cue sheets.');
        } finally {
            setExportingTarget(undefined);
        }
    };

    if (!loading && review.entries.length === 0) return;

    const summary = createAssetAudioCueReviewSummary(review.entries);
    const filterEntries = filterAssetAudioCueReviewEntries(review.entries, reviewFilter);
    const visibleEntries = searchAssetAudioCueReviewEntries(filterEntries, cueSearchQuery);
    const visibleSummary = createAssetAudioCueReviewSummary(visibleEntries);
    const exportStatus = createAssetAudioCueExportReadiness(visibleEntries);
    const isExporting = exportingTarget !== undefined;
    const cueOrganizationAssetUrls = collectAssetAudioCueOrganizationAssetUrls(visibleEntries);
    const exportableVisibleCount = visibleSummary.exportableEntryCount;

    return (
        <section aria-busy={loading || isExporting} style={sectionStyle(uiScale)}>
            <div style={sectionTitleRowStyle(uiScale)}>
                <div style={sectionHeaderStyle(uiScale)}>Audio cue review</div>
                <div style={{ alignItems: 'center', display: 'flex', gap: `${6 * uiScale}px` }}>
                    <span aria-live="polite" role="status" style={{ color: t.text.faint, fontSize: `${11 * uiScale}px` }}>
                        {loading ? 'Loading...' : `${visibleEntries.length}/${summary.totalEntryCount} sheet${summary.totalEntryCount === 1 ? '' : 's'} | ${visibleSummary.totalCueCount} cue${visibleSummary.totalCueCount === 1 ? '' : 's'}`}
                    </span>
                    {onOrganizeCueAssets ? (
                        <button
                            className="toolbar-btn"
                            disabled={cueOrganizationAssetUrls.length === 0 || isExporting}
                            onClick={() => onOrganizeCueAssets(cueOrganizationAssetUrls)}
                            style={miniButtonStyle(uiScale, cueOrganizationAssetUrls.length === 0 || isExporting)}
                            title="Organize visible cue sheets and available source audio"
                            type="button"
                        >
                            <Tags size={13 * uiScale} />
                            <span>Organize Cue Assets ({cueOrganizationAssetUrls.length})</span>
                        </button>
                    ) : undefined}
                    <button
                        className="toolbar-btn"
                        disabled={isExporting || exportableVisibleCount === 0}
                        onClick={() => {
                            void exportVisible();
                        }}
                        style={miniButtonStyle(uiScale, isExporting || exportableVisibleCount === 0)}
                        title="Export visible audiosheet cues as WAV files"
                        type="button"
                    >
                        <Download size={13 * uiScale} />
                        <span>{exportingTarget === 'visible' ? 'Exporting...' : 'Export Visible'}</span>
                    </button>
                </div>
            </div>
            <div style={kindSummaryRowStyle(uiScale)}>
                <CueReviewFilterButton
                    count={summary.totalEntryCount}
                    filter="all"
                    label="All"
                    onFilterChange={setReviewFilter}
                    selected={reviewFilter === 'all'}
                    uiScale={uiScale}
                />
                <CueReviewFilterButton
                    count={summary.exportableEntryCount}
                    detail={`${summary.exportableCueCount} cue${summary.exportableCueCount === 1 ? '' : 's'}`}
                    filter="exportable"
                    label="Exportable"
                    onFilterChange={setReviewFilter}
                    selected={reviewFilter === 'exportable'}
                    uiScale={uiScale}
                />
                <CueReviewFilterButton
                    count={summary.issueEntryCount}
                    filter="issues"
                    label="Issues"
                    onFilterChange={setReviewFilter}
                    selected={reviewFilter === 'issues'}
                    uiScale={uiScale}
                />
                <CueReviewFilterButton
                    count={summary.missingSourceEntryCount}
                    filter="missing-source"
                    label="Missing source"
                    onFilterChange={setReviewFilter}
                    selected={reviewFilter === 'missing-source'}
                    uiScale={uiScale}
                />
            </div>
            <input
                aria-label="Search audio cue review"
                onChange={(event) => setCueSearchQuery(event.currentTarget.value)}
                placeholder="Find cue, sheet, source, or issue"
                style={{ ...searchInputStyle(uiScale), minHeight: `${24 * uiScale}px` }}
                value={cueSearchQuery}
            />
            <div aria-label="Audio cue export status" style={cueExportStatusStyle(uiScale, exportStatus.status)}>
                <span style={cueExportStatusPillStyle(uiScale, exportStatus.status)}>
                    {exportStatus.status === 'ready' ? <CheckCircle2 size={13 * uiScale} /> : <AlertTriangle size={13 * uiScale} />}
                    <span>Export status: {formatStatus(exportStatus.status)}</span>
                </span>
                <span style={{ color: t.text.muted }}>{exportStatus.message}</span>
                {exportStatus.detailMessages.map((message) => (
                    <span key={message} style={{ color: exportStatus.status === 'ready' ? t.text.faint : t.accent.yellow }}>
                        {message}
                    </span>
                ))}
            </div>
            {review.issueCount > 0 ? (
                <div style={{ alignItems: 'center', color: t.accent.yellow, display: 'flex', fontSize: `${11 * uiScale}px`, gap: `${5 * uiScale}px` }}>
                    <AlertTriangle size={13 * uiScale} />
                    <span>{review.issueCount} cue review issue{review.issueCount === 1 ? '' : 's'}</span>
                </div>
            ) : undefined}
            {visibleEntries.length === 0 ? (
                <div style={{ color: t.text.faint, fontStyle: 'italic' }}>
                    No cue sheets match this review filter.
                </div>
            ) : undefined}
            {visibleEntries.map((entry) => (
                <div key={entry.descriptorAssetUrl} style={cueRowStyle(uiScale, entry.issueMessages.length > 0)}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: `${3 * uiScale}px`, minWidth: 0 }}>
                        <strong style={{ color: t.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.descriptorAssetUrl}
                        </strong>
                        <span style={{ color: t.text.muted, fontSize: `${11 * uiScale}px` }}>
                            {entry.cueCount} cue{entry.cueCount === 1 ? '' : 's'} | {formatSeconds(entry.finiteDurationSeconds)} finite | {entry.loopCueCount} loop | {entry.volumeOverrideCueCount} volume override{entry.volumeOverrideCueCount === 1 ? '' : 's'}
                        </span>
                        {entry.cueNames.length > 0 ? (
                            <span style={{ color: t.text.faint, fontSize: `${11 * uiScale}px`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                Cues: {formatCueNames(entry.cueNames)}
                            </span>
                        ) : undefined}
                        {entry.sourceAssetUrl ? (
                            <span style={{ color: entry.sourceAvailable === false ? t.accent.red : t.text.faint, fontSize: `${11 * uiScale}px` }}>
                                Source: {entry.sourceAssetUrl}
                            </span>
                        ) : undefined}
                        {entry.issueMessages.map((issue) => (
                            <span key={issue} style={{ color: t.accent.yellow, fontSize: `${11 * uiScale}px` }}>
                                {issue}
                            </span>
                        ))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: `${4 * uiScale}px` }}>
                        <button
                            className="toolbar-btn"
                            disabled={isExporting || entry.cueCount === 0 || entry.sourceAvailable === false}
                            onClick={() => {
                                void exportOne(entry.descriptorAssetUrl);
                            }}
                            style={miniButtonStyle(uiScale, isExporting || entry.cueCount === 0 || entry.sourceAvailable === false)}
                            title={`Export cues from ${entry.descriptorAssetUrl}`}
                            type="button"
                        >
                            <Download size={13 * uiScale} />
                            <span>{exportingTarget === entry.descriptorAssetUrl ? 'Exporting...' : 'Export'}</span>
                        </button>
                        <button
                            className="toolbar-btn"
                            onClick={() => onOpenAsset(entry.descriptorAssetUrl)}
                            style={miniButtonStyle(uiScale, false)}
                            title={`Open ${entry.descriptorAssetUrl}`}
                            type="button"
                        >
                            <ExternalLink size={13 * uiScale} />
                            <span>Open Sheet</span>
                        </button>
                        {entry.sourceAssetUrl ? (
                            <button
                                className="toolbar-btn"
                                disabled={entry.sourceAvailable === false}
                                onClick={() => {
                                    const sourceAssetUrl = entry.sourceAssetUrl ?? '';
                                    (onOpenSourceAsset ?? onOpenAsset)(sourceAssetUrl);
                                }}
                                style={miniButtonStyle(uiScale, entry.sourceAvailable === false)}
                                title={`Open source audio ${entry.sourceAssetUrl}`}
                                type="button"
                            >
                                <ExternalLink size={13 * uiScale} />
                                <span>Open Source</span>
                            </button>
                        ) : undefined}
                    </div>
                </div>
            ))}
            {exportMessage ? (
                <div
                    aria-live="polite"
                    role="status"
                    style={{ color: exportMessage.includes('failed') || exportMessage.includes('Failed') ? t.accent.yellow : t.text.muted, fontSize: `${11 * uiScale}px` }}
                >
                    {exportMessage}
                </div>
            ) : undefined}
        </section>
    );
}

function cueExportStatusPillStyle(
    uiScale: number,
    status: 'blocked' | 'limited' | 'ready',
) {
    const color = status === 'ready'
        ? t.accent.green
        : (status === 'limited' ? t.accent.yellow : t.accent.orange);
    return {
        alignItems: 'center',
        border: `1px solid ${color}`,
        borderRadius: t.radius.sm,
        color,
        display: 'inline-flex',
        fontSize: `${11 * uiScale}px`,
        fontWeight: 700,
        gap: `${4 * uiScale}px`,
        padding: `${3 * uiScale}px ${6 * uiScale}px`,
        whiteSpace: 'nowrap' as const,
    };
}

function cueExportStatusStyle(
    uiScale: number,
    status: 'blocked' | 'limited' | 'ready',
) {
    const color = status === 'ready'
        ? t.accent.green
        : (status === 'limited' ? t.accent.yellow : t.accent.orange);
    return {
        alignItems: 'center',
        border: `1px solid ${color}`,
        borderRadius: t.radius.sm,
        display: 'flex',
        flexWrap: 'wrap' as const,
        fontSize: `${11 * uiScale}px`,
        gap: `${5 * uiScale}px`,
        padding: `${5 * uiScale}px ${7 * uiScale}px`,
    };
}

function CueReviewFilterButton({
    count,
    detail,
    filter,
    label,
    onFilterChange,
    selected,
    uiScale,
}: {
    count: number;
    detail?: string;
    filter: AssetAudioCueReviewFilter;
    label: string;
    onFilterChange: (filter: AssetAudioCueReviewFilter) => void;
    selected: boolean;
    uiScale: number;
}) {
    const disabled = count === 0 && filter !== 'all';
    return (
        <button
            className="toolbar-btn"
            disabled={disabled}
            onClick={() => onFilterChange(selected ? 'all' : filter)}
            style={{
                ...kindSummaryChipStyle(uiScale, selected),
                color: disabled ? t.text.faint : t.text.normal,
                cursor: disabled ? 'not-allowed' : 'pointer',
            }}
            type="button"
        >
            {label} {count}
            {detail ? <span style={{ color: t.text.faint }}>{' '}({detail})</span> : undefined}
        </button>
    );
}

function cueRowStyle(uiScale: number, hasIssue: boolean) {
    return {
        alignItems: 'flex-start',
        background: t.bg.panel,
        border: `1px solid ${hasIssue ? t.accent.yellow : t.border.subtle}`,
        borderRadius: t.radius.sm,
        display: 'flex',
        gap: `${6 * uiScale}px`,
        justifyContent: 'space-between',
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
    };
}

function formatCueNames(cueNames: readonly string[]): string {
    const preview = cueNames.slice(0, 6).join(', ');
    const remaining = cueNames.length - 6;
    return remaining > 0 ? `${preview}, +${remaining} more` : preview;
}

function formatSeconds(value: number): string {
    if (value <= 0) return '0.00s';
    return `${value.toFixed(2)}s`;
}

function formatStatus(status: 'blocked' | 'limited' | 'ready'): string {
    switch (status) {
        case 'blocked': {
            return 'Blocked';
        }
        case 'limited': {
            return 'Limited';
        }
        case 'ready': {
            return 'Ready';
        }
    }
}
