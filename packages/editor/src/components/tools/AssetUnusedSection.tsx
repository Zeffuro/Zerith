import { CheckSquare, FolderInput, Square, Tag } from 'lucide-react';

import type { AssetLibraryMetadata } from '../../services/assetLibraryMetadata';

import { editorTheme as t } from '../../theme/editorTheme';
import {
    getAssetLibraryAssetMetadata,
    type UnusedAssetFolderGroup,
} from './assetDependencyPanelModel';
import {
    folderGroupButtonStyle,
    folderGroupGridStyle,
    miniButtonStyle,
    sectionHeaderStyle,
    sectionStyle,
    sectionTitleRowStyle,
    unusedRowStyle,
} from './assetDependencyPanelStyles';
import { AssetMetadataChips } from './AssetDependencyRows';

type Properties = {
    allUnusedAssetsSelected: boolean;
    assetLibraryMetadata: AssetLibraryMetadata;
    assetUrls: string[];
    isFilteringAssets: boolean;
    movingAssetUrl?: string;
    onClearVisible: () => void;
    onEditMetadata: (assetUrl: string) => void;
    onMoveAsset: (assetUrl: string) => void;
    onOrganizeSelected: () => void;
    onSelectFolder: (assetUrls: string[]) => void;
    onSelectVisible: () => void;
    onToggleAssetSelection: (assetUrl: string, selected: boolean) => void;
    savingMetadataAssetUrl?: string;
    selectedAssetSet: ReadonlySet<string>;
    selectedCount: number;
    uiScale: number;
    unusedFolderGroups: UnusedAssetFolderGroup[];
};

export function AssetUnusedSection({
    allUnusedAssetsSelected,
    assetLibraryMetadata,
    assetUrls,
    isFilteringAssets,
    movingAssetUrl,
    onClearVisible,
    onEditMetadata,
    onMoveAsset,
    onOrganizeSelected,
    onSelectFolder,
    onSelectVisible,
    onToggleAssetSelection,
    savingMetadataAssetUrl,
    selectedAssetSet,
    selectedCount,
    uiScale,
    unusedFolderGroups,
}: Properties) {
    return (
        <section style={sectionStyle(uiScale)}>
            <div style={sectionTitleRowStyle(uiScale)}>
                <div style={sectionHeaderStyle(uiScale)}>Unused assets</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${6 * uiScale}px`, justifyContent: 'flex-end' }}>
                    <button
                        className="toolbar-btn"
                        disabled={assetUrls.length === 0 || allUnusedAssetsSelected}
                        onClick={onSelectVisible}
                        style={miniButtonStyle(uiScale, assetUrls.length === 0 || allUnusedAssetsSelected)}
                        title={isFilteringAssets ? 'Select visible unused assets' : 'Select all unused assets'}
                        type="button"
                    >
                        <CheckSquare size={13 * uiScale} />
                        <span>{isFilteringAssets ? 'Select visible' : 'Select all'}</span>
                    </button>
                    <button
                        className="toolbar-btn"
                        disabled={selectedCount === 0}
                        onClick={onClearVisible}
                        style={miniButtonStyle(uiScale, selectedCount === 0)}
                        title={isFilteringAssets ? 'Clear visible unused asset selection' : 'Clear unused asset selection'}
                        type="button"
                    >
                        <Square size={13 * uiScale} />
                        <span>{isFilteringAssets ? 'Clear visible' : 'Clear'}</span>
                    </button>
                    <button
                        className="toolbar-btn"
                        disabled={selectedCount === 0 || Boolean(savingMetadataAssetUrl)}
                        onClick={onOrganizeSelected}
                        style={miniButtonStyle(uiScale, selectedCount === 0 || Boolean(savingMetadataAssetUrl))}
                        title="Apply metadata labels to selected unused assets"
                        type="button"
                    >
                        <Tag size={13 * uiScale} />
                        <span>Organize selected...</span>
                    </button>
                </div>
            </div>
            <div style={{ color: t.text.faint, fontSize: `${11 * uiScale}px` }}>
                {isFilteringAssets ? 'Selected visible for cleanup' : 'Selected for cleanup'}: {selectedCount}
            </div>
            {unusedFolderGroups.length > 1 ? (
                <div style={folderGroupGridStyle(uiScale)}>
                    {unusedFolderGroups.map((group) => {
                        const selectedFolderCount = group.assetUrls.filter((assetUrl) => selectedAssetSet.has(assetUrl)).length;
                        return (
                            <button
                                className="toolbar-btn"
                                key={group.folder}
                                onClick={() => onSelectFolder(group.assetUrls)}
                                style={folderGroupButtonStyle(uiScale, selectedFolderCount === group.assetUrls.length)}
                                title={`Select unused assets in ${group.folder}`}
                                type="button"
                            >
                                <FolderInput size={13 * uiScale} />
                                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.folder}</span>
                                <span style={{ color: t.text.faint, marginLeft: 'auto' }}>{selectedFolderCount}/{group.assetUrls.length}</span>
                            </button>
                        );
                    })}
                </div>
            ) : undefined}
            {assetUrls.length === 0 && (
                <div style={{ color: t.text.faint, fontStyle: 'italic' }}>
                    {isFilteringAssets ? 'No unused assets match the current filter.' : 'No unused assets detected.'}
                </div>
            )}
            {assetUrls.map((assetUrl) => {
                const isMoving = movingAssetUrl === assetUrl;
                const assetMetadata = getAssetLibraryAssetMetadata(assetLibraryMetadata, assetUrl);
                return (
                    <div key={`unused-${assetUrl}`} style={unusedRowStyle(uiScale, selectedAssetSet.has(assetUrl))}>
                        <label style={{ alignItems: 'center', display: 'flex', flex: 1, gap: `${6 * uiScale}px`, minWidth: 0 }}>
                            <input
                                checked={selectedAssetSet.has(assetUrl)}
                                onChange={(event) => onToggleAssetSelection(assetUrl, event.currentTarget.checked)}
                                type="checkbox"
                            />
                            <span style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: `${3 * uiScale}px`, minWidth: 0 }}>
                                <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{assetUrl}</span>
                                <AssetMetadataChips metadata={assetMetadata} uiScale={uiScale} />
                            </span>
                        </label>
                        <button
                            className="toolbar-btn"
                            disabled={savingMetadataAssetUrl === assetUrl}
                            onClick={() => onEditMetadata(assetUrl)}
                            style={miniButtonStyle(uiScale, savingMetadataAssetUrl === assetUrl)}
                            title={`Organize ${assetUrl}`}
                            type="button"
                        >
                            <Tag size={13 * uiScale} />
                            <span>{savingMetadataAssetUrl === assetUrl ? 'Saving...' : 'Organize...'}</span>
                        </button>
                        <button
                            className="toolbar-btn"
                            disabled={Boolean(movingAssetUrl)}
                            onClick={() => onMoveAsset(assetUrl)}
                            style={miniButtonStyle(uiScale, Boolean(movingAssetUrl))}
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
    );
}
