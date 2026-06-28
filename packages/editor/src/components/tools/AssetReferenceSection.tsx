import { Tag } from 'lucide-react';

import type { AssetLibraryMetadata } from '../../services/assetLibraryMetadata';
import type { AssetUsageEntry, ReferenceLocation } from '../../services/referenceScanner';

import { editorTheme as t } from '../../theme/editorTheme';
import { getAssetLibraryAssetMetadata } from './assetDependencyPanelModel';
import {
    miniButtonStyle,
    sectionHeaderStyle,
    sectionStyle,
    sectionTitleRowStyle,
} from './assetDependencyPanelStyles';
import { EntryBlock } from './AssetDependencyRows';

type Properties = {
    assetLibraryMetadata: AssetLibraryMetadata;
    bulkDisabled: boolean;
    emptyMessage: string;
    entries: AssetUsageEntry[];
    movingAssetUrl?: string;
    onEditMetadata: (assetUrl: string) => void;
    onMoveAsset?: (assetUrl: string) => void;
    onOpenLocation: (location: ReferenceLocation) => Promise<void>;
    onOrganizeVisible: () => void;
    subtitleForEntry: (entry: AssetUsageEntry) => string;
    title: string;
    uiScale: number;
};

export function AssetReferenceSection({
    assetLibraryMetadata,
    bulkDisabled,
    emptyMessage,
    entries,
    movingAssetUrl,
    onEditMetadata,
    onMoveAsset,
    onOpenLocation,
    onOrganizeVisible,
    subtitleForEntry,
    title,
    uiScale,
}: Properties) {
    return (
        <section style={sectionStyle(uiScale)}>
            <div style={sectionTitleRowStyle(uiScale)}>
                <div style={sectionHeaderStyle(uiScale)}>{title}</div>
                <button
                    className="toolbar-btn"
                    disabled={entries.length === 0 || bulkDisabled}
                    onClick={onOrganizeVisible}
                    style={miniButtonStyle(uiScale, entries.length === 0 || bulkDisabled)}
                    title={`Apply metadata labels to visible ${title.toLocaleLowerCase()}`}
                    type="button"
                >
                    <Tag size={13 * uiScale} />
                    <span>Organize visible...</span>
                </button>
            </div>
            {entries.length === 0 && (
                <div style={{ color: t.text.faint, fontStyle: 'italic' }}>
                    {emptyMessage}
                </div>
            )}
            {entries.map((entry) => (
                <EntryBlock
                    key={`${title}-${entry.assetUrl}`}
                    locations={entry.references}
                    metadata={getAssetLibraryAssetMetadata(assetLibraryMetadata, entry.assetUrl)}
                    moveDisabled={Boolean(movingAssetUrl)}
                    moving={movingAssetUrl === entry.assetUrl}
                    name={entry.assetUrl}
                    onEditMetadata={onEditMetadata}
                    onMoveAsset={onMoveAsset}
                    onOpenLocation={onOpenLocation}
                    subtitle={subtitleForEntry(entry)}
                    uiScale={uiScale}
                />
            ))}
        </section>
    );
}
