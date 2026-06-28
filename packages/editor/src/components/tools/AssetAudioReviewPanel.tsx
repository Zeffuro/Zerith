import { Tags } from 'lucide-react';

import { editorTheme as t } from '../../theme/editorTheme';
import {
    type AssetLibraryAudioRoleFilter,
    type AssetLibraryAudioRoleSummary,
    formatAssetAudioRole,
} from './assetAudioRoleModel';
import {
    kindSummaryChipStyle,
    kindSummaryRowStyle,
    miniButtonStyle,
} from './assetDependencyPanelStyles';

type Properties = {
    filter: AssetLibraryAudioRoleFilter;
    isApplyingRoleLabels?: boolean;
    onApplyRoleLabels?: () => void;
    onFilterChange: (filter: AssetLibraryAudioRoleFilter) => void;
    roleLabelAssetCount: number;
    summary: AssetLibraryAudioRoleSummary[];
    total: number;
    uiScale: number;
};

export function AssetAudioReviewPanel({
    filter,
    isApplyingRoleLabels = false,
    onApplyRoleLabels,
    onFilterChange,
    roleLabelAssetCount,
    summary,
    total,
    uiScale,
}: Properties) {
    if (total === 0) return null;

    return (
        <>
            <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                Audio review: {total} asset{total === 1 ? '' : 's'} across {summary.length} role{summary.length === 1 ? '' : 's'}
            </div>
            <div style={kindSummaryRowStyle(uiScale)}>
                {onApplyRoleLabels ? (
                    <button
                        className="toolbar-btn"
                        disabled={isApplyingRoleLabels || roleLabelAssetCount === 0}
                        onClick={onApplyRoleLabels}
                        style={miniButtonStyle(uiScale, isApplyingRoleLabels || roleLabelAssetCount === 0)}
                        title="Add Audio collection and role tags to visible audio assets"
                        type="button"
                    >
                        <Tags size={13 * uiScale} />
                        <span>{isApplyingRoleLabels ? 'Applying role labels...' : `Apply role labels (${roleLabelAssetCount})`}</span>
                    </button>
                ) : undefined}
                <button
                    className="toolbar-btn"
                    onClick={() => onFilterChange('all')}
                    style={kindSummaryChipStyle(uiScale, filter === 'all')}
                    type="button"
                >
                    All audio {total}
                </button>
                {summary.map((entry) => (
                    <button
                        className="toolbar-btn"
                        key={entry.role}
                        onClick={() => onFilterChange(filter === entry.role ? 'all' : entry.role)}
                        style={kindSummaryChipStyle(uiScale, filter === entry.role)}
                        type="button"
                    >
                        {formatAssetAudioRole(entry.role)} {entry.total}
                        <span style={{ color: t.text.faint }}>
                            {' '}({entry.used}/{entry.unused}/{entry.missing})
                        </span>
                    </button>
                ))}
            </div>
        </>
    );
}
