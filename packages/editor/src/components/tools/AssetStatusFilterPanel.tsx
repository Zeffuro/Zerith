import { editorTheme as t } from '../../theme/editorTheme';
import {
    type AssetLibraryStatusFilter,
    type AssetLibraryStatusSummary,
} from './assetDependencyPanelModel';
import {
    kindSummaryChipStyle,
    kindSummaryRowStyle,
} from './assetDependencyPanelStyles';

type Properties = {
    filter: AssetLibraryStatusFilter;
    onFilterChange: (filter: AssetLibraryStatusFilter) => void;
    summary: AssetLibraryStatusSummary;
    uiScale: number;
};

export function AssetStatusFilterPanel({
    filter,
    onFilterChange,
    summary,
    uiScale,
}: Properties) {
    if (summary.total === 0) return;

    return (
        <div style={kindSummaryRowStyle(uiScale)}>
            <StatusFilterButton
                count={summary.total}
                filter="all"
                label="All"
                onFilterChange={onFilterChange}
                selected={filter === 'all'}
                uiScale={uiScale}
            />
            <StatusFilterButton
                count={summary.used}
                filter="used"
                label="Used"
                onFilterChange={onFilterChange}
                selected={filter === 'used'}
                uiScale={uiScale}
            />
            <StatusFilterButton
                count={summary.unused}
                filter="unused"
                label="Unused"
                onFilterChange={onFilterChange}
                selected={filter === 'unused'}
                uiScale={uiScale}
            />
            <StatusFilterButton
                count={summary.missing}
                filter="missing"
                label="Missing"
                onFilterChange={onFilterChange}
                selected={filter === 'missing'}
                uiScale={uiScale}
            />
        </div>
    );
}

function StatusFilterButton({
    count,
    filter,
    label,
    onFilterChange,
    selected,
    uiScale,
}: {
    count: number;
    filter: AssetLibraryStatusFilter;
    label: string;
    onFilterChange: (filter: AssetLibraryStatusFilter) => void;
    selected: boolean;
    uiScale: number;
}) {
    return (
        <button
            className="toolbar-btn"
            disabled={count === 0 && filter !== 'all'}
            onClick={() => onFilterChange(selected ? 'all' : filter)}
            style={{
                ...kindSummaryChipStyle(uiScale, selected),
                color: count === 0 && filter !== 'all' ? t.text.faint : t.text.normal,
                cursor: count === 0 && filter !== 'all' ? 'not-allowed' : 'pointer',
            }}
            type="button"
        >
            {label} {count}
        </button>
    );
}
