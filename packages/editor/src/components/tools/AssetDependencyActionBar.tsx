import { Search, Tags, Trash2, Upload, X } from 'lucide-react';

import {
    actionButtonStyle,
    searchBoxStyle,
    searchInputStyle,
} from './assetDependencyPanelStyles';

type Properties = {
    assetSearchQuery: string;
    isDeletingUnused: boolean;
    isFilteringAssets: boolean;
    isImportingAssets: boolean;
    isOrganizingVisible: boolean;
    onClearFilters: () => void;
    onDeleteSelectedUnused: () => void;
    onImportAssets: () => void;
    onOrganizeVisible: () => void;
    onSearchQueryChange: (query: string) => void;
    selectedUnusedCount: number;
    uiScale: number;
    visibleAssetCount: number;
};

export function AssetDependencyActionBar({
    assetSearchQuery,
    isDeletingUnused,
    isFilteringAssets,
    isImportingAssets,
    isOrganizingVisible,
    onClearFilters,
    onDeleteSelectedUnused,
    onImportAssets,
    onOrganizeVisible,
    onSearchQueryChange,
    selectedUnusedCount,
    uiScale,
    visibleAssetCount,
}: Properties) {
    const organizeVisibleDisabled = visibleAssetCount === 0 || isOrganizingVisible;

    return (
        <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${6 * uiScale}px` }}>
                <button
                    className="toolbar-btn"
                    disabled={isImportingAssets}
                    onClick={onImportAssets}
                    style={actionButtonStyle(uiScale, isImportingAssets)}
                    type="button"
                >
                    <Upload size={14 * uiScale} />
                    <span>{isImportingAssets ? 'Importing assets...' : 'Import assets...'}</span>
                </button>

                <button
                    className="toolbar-btn"
                    disabled={selectedUnusedCount === 0 || isDeletingUnused}
                    onClick={onDeleteSelectedUnused}
                    style={actionButtonStyle(uiScale, selectedUnusedCount === 0 || isDeletingUnused, selectedUnusedCount > 0)}
                    type="button"
                >
                    <Trash2 size={14 * uiScale} />
                    <span>{isDeletingUnused ? 'Deleting unused assets...' : `Delete selected unused assets (${selectedUnusedCount})`}</span>
                </button>

                <button
                    className="toolbar-btn"
                    disabled={organizeVisibleDisabled}
                    onClick={onOrganizeVisible}
                    style={actionButtonStyle(uiScale, organizeVisibleDisabled)}
                    type="button"
                >
                    <Tags size={14 * uiScale} />
                    <span>{isOrganizingVisible ? 'Organizing assets...' : `Organize visible assets (${visibleAssetCount})`}</span>
                </button>

                <button
                    className="toolbar-btn"
                    disabled={!isFilteringAssets}
                    onClick={onClearFilters}
                    style={actionButtonStyle(uiScale, !isFilteringAssets)}
                    type="button"
                >
                    <X size={14 * uiScale} />
                    <span>Clear filters</span>
                </button>
            </div>

            <label style={searchBoxStyle(uiScale)}>
                <Search size={14 * uiScale} />
                <input
                    aria-label="Filter asset dependencies"
                    onChange={(event) => onSearchQueryChange(event.currentTarget.value)}
                    placeholder="Filter assets, scenes, commands, or paths"
                    style={searchInputStyle(uiScale)}
                    type="search"
                    value={assetSearchQuery}
                />
            </label>
        </>
    );
}
