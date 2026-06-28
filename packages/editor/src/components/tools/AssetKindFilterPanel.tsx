import { editorTheme as t } from '../../theme/editorTheme';
import {
    type AssetLibraryKindFilter,
    type AssetLibraryKindSummary,
} from './assetDependencyPanelModel';
import {
    kindSummaryChipStyle,
    kindSummaryRowStyle,
} from './assetDependencyPanelStyles';

type Properties = {
    filter: AssetLibraryKindFilter;
    onFilterChange: (filter: AssetLibraryKindFilter) => void;
    summary: AssetLibraryKindSummary[];
    total: number;
    uiScale: number;
};

export function AssetKindFilterPanel({
    filter,
    onFilterChange,
    summary,
    total,
    uiScale,
}: Properties) {
    if (summary.length === 0) return;

    return (
        <div style={kindSummaryRowStyle(uiScale)}>
            <button
                className="toolbar-btn"
                onClick={() => onFilterChange('all')}
                style={kindSummaryChipStyle(uiScale, filter === 'all')}
                type="button"
            >
                All {total}
            </button>
            {summary.map((entry) => (
                <button
                    className="toolbar-btn"
                    key={entry.kind}
                    onClick={() => onFilterChange(filter === entry.kind ? 'all' : entry.kind)}
                    style={kindSummaryChipStyle(uiScale, filter === entry.kind)}
                    type="button"
                >
                    {formatAssetKind(entry.kind)} {entry.total}
                    <span style={{ color: t.text.faint }}>
                        {' '}({entry.used}/{entry.unused}/{entry.missing})
                    </span>
                </button>
            ))}
        </div>
    );
}

function formatAssetKind(kind: string): string {
    return kind.slice(0, 1).toUpperCase() + kind.slice(1);
}
