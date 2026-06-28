import { AlertTriangle, Download, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { AssetAudioCueReview } from '../../services/assetAudioCueReview';

import { loadAssetAudioCueReview } from '../../services/assetAudioCueReview';
import { exportAssetAudioCuesToProject } from '../../services/assetAudioCueExport';
import { refreshProjectTree } from '../../services/explorerFileActions';
import { refreshReferenceScannerState } from '../../services/referenceScanner';
import { editorTheme as t } from '../../theme/editorTheme';
import {
    miniButtonStyle,
    sectionHeaderStyle,
    sectionStyle,
    sectionTitleRowStyle,
} from './assetDependencyPanelStyles';

type Properties = {
    assetInventory: string[];
    assetUrls: string[];
    onOpenSheet: (assetUrl: string) => void;
    projectPath: string;
    uiScale: number;
};

export function AssetAudioCueReviewPanel({
    assetInventory,
    assetUrls,
    onOpenSheet,
    projectPath,
    uiScale,
}: Properties) {
    const [review, setReview] = useState<AssetAudioCueReview>({ entries: [], issueCount: 0, totalCues: 0 });
    const [exportMessage, setExportMessage] = useState<string>();
    const [exportingTarget, setExportingTarget] = useState<string>();
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
        const exportableEntries = review.entries.filter((entry) => entry.cueCount > 0 && entry.sourceAvailable !== false);
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

    if (!loading && review.entries.length === 0) return null;

    const isExporting = exportingTarget !== undefined;
    const exportableVisibleCount = review.entries.filter((entry) => entry.cueCount > 0 && entry.sourceAvailable !== false).length;

    return (
        <section style={sectionStyle(uiScale)}>
            <div style={sectionTitleRowStyle(uiScale)}>
                <div style={sectionHeaderStyle(uiScale)}>Audio cue review</div>
                <div style={{ alignItems: 'center', display: 'flex', gap: `${6 * uiScale}px` }}>
                    <span style={{ color: t.text.faint, fontSize: `${11 * uiScale}px` }}>
                        {loading ? 'Loading...' : `${review.entries.length} sheet${review.entries.length === 1 ? '' : 's'} | ${review.totalCues} cue${review.totalCues === 1 ? '' : 's'}`}
                    </span>
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
            {review.issueCount > 0 ? (
                <div style={{ alignItems: 'center', color: t.accent.yellow, display: 'flex', fontSize: `${11 * uiScale}px`, gap: `${5 * uiScale}px` }}>
                    <AlertTriangle size={13 * uiScale} />
                    <span>{review.issueCount} cue review issue{review.issueCount === 1 ? '' : 's'}</span>
                </div>
            ) : undefined}
            {review.entries.map((entry) => (
                <div key={entry.descriptorAssetUrl} style={cueRowStyle(uiScale, entry.issueMessages.length > 0)}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: `${3 * uiScale}px`, minWidth: 0 }}>
                        <strong style={{ color: t.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.descriptorAssetUrl}
                        </strong>
                        <span style={{ color: t.text.muted, fontSize: `${11 * uiScale}px` }}>
                            {entry.cueCount} cue{entry.cueCount === 1 ? '' : 's'} | {formatSeconds(entry.finiteDurationSeconds)} finite | {entry.loopCueCount} loop | {entry.volumeOverrideCueCount} volume override{entry.volumeOverrideCueCount === 1 ? '' : 's'}
                        </span>
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
                            onClick={() => onOpenSheet(entry.descriptorAssetUrl)}
                            style={miniButtonStyle(uiScale, false)}
                            title={`Open ${entry.descriptorAssetUrl}`}
                            type="button"
                        >
                            <ExternalLink size={13 * uiScale} />
                            <span>Open</span>
                        </button>
                    </div>
                </div>
            ))}
            {exportMessage ? (
                <div style={{ color: exportMessage.includes('failed') || exportMessage.includes('Failed') ? t.accent.yellow : t.text.muted, fontSize: `${11 * uiScale}px` }}>
                    {exportMessage}
                </div>
            ) : undefined}
        </section>
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

function formatSeconds(value: number): string {
    if (value <= 0) return '0.00s';
    return `${value.toFixed(2)}s`;
}
