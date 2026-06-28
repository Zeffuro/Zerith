import { FolderInput, Tag } from 'lucide-react';
import { useState } from 'react';

import type { AssetLibraryAssetMetadata } from '../../services/assetLibraryMetadata';
import type { ReferenceLocation } from '../../services/referenceScanner';

import { editorTheme as t } from '../../theme/editorTheme';
import {
    metadataChipRowStyle,
    metadataChipStyle,
    miniButtonStyle,
} from './assetDependencyPanelStyles';

export function AssetMetadataChips({
    metadata,
    uiScale,
}: {
    metadata: AssetLibraryAssetMetadata;
    uiScale: number;
}) {
    if (metadata.collections.length === 0 && metadata.tags.length === 0) {
        return;
    }

    return (
        <span style={metadataChipRowStyle(uiScale)}>
            {metadata.collections.map((collection) => (
                <span key={`collection-${collection}`} style={metadataChipStyle(uiScale, 'collection')}>
                    {collection}
                </span>
            ))}
            {metadata.tags.map((tag) => (
                <span key={`tag-${tag}`} style={metadataChipStyle(uiScale, 'tag')}>
                    #{tag}
                </span>
            ))}
        </span>
    );
}

export function EntryBlock({
    locations,
    metadata,
    moveDisabled = false,
    moving = false,
    name,
    onEditMetadata,
    onMoveAsset,
    onOpenLocation,
    subtitle,
    uiScale,
}: {
    locations: ReferenceLocation[];
    metadata: AssetLibraryAssetMetadata;
    moveDisabled?: boolean;
    moving?: boolean;
    name: string;
    onEditMetadata: (assetUrl: string) => void;
    onMoveAsset?: (assetUrl: string) => void;
    onOpenLocation: (location: ReferenceLocation) => Promise<void>;
    subtitle: string;
    uiScale: number;
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div style={{ border: `1px solid ${t.border.subtle}`, borderRadius: t.radius.sm, padding: `${6 * uiScale}px` }}>
            <div style={{ alignItems: 'flex-start', display: 'flex', gap: `${6 * uiScale}px` }}>
                <button className="toolbar-btn" onClick={() => setExpanded((value) => !value)} style={entryHeaderStyle(uiScale)} type="button">
                    <span style={{ color: t.text.primary, fontWeight: 600 }}>{name}</span>
                    <span style={{ color: t.text.faint }}>{subtitle}</span>
                    <AssetMetadataChips metadata={metadata} uiScale={uiScale} />
                </button>
                <button
                    className="toolbar-btn"
                    onClick={() => onEditMetadata(name)}
                    style={miniButtonStyle(uiScale, false)}
                    title={`Organize ${name}`}
                    type="button"
                >
                    <Tag size={13 * uiScale} />
                    <span>Organize...</span>
                </button>
                {onMoveAsset ? (
                    <button
                        className="toolbar-btn"
                        disabled={moveDisabled}
                        onClick={() => onMoveAsset(name)}
                        style={miniButtonStyle(uiScale, moveDisabled)}
                        title={`Move ${name}`}
                        type="button"
                    >
                        <FolderInput size={13 * uiScale} />
                        <span>{moving ? 'Moving...' : 'Move...'}</span>
                    </button>
                ) : undefined}
            </div>

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

function basename(path: string): string {
    return path.split(/[\\/]/).pop() || path;
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
