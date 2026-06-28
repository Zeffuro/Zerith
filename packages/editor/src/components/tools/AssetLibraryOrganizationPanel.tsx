import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { editorTheme as t } from '../../theme/editorTheme';
import {
    kindSummaryChipStyle,
    kindSummaryRowStyle,
    miniButtonStyle,
    searchInputStyle,
} from './assetDependencyPanelStyles';
import type {
    AssetLibraryOrganizationFilter,
    AssetLibraryOrganizationSummary,
    AssetLibraryOrganizationSummaryEntry,
} from './assetDependencyPanelModel';

type Properties = {
    busy: boolean;
    filter: AssetLibraryOrganizationFilter;
    isLoading: boolean;
    onAddCollectionToVisible: (collection: string) => void;
    onFilterChange: (filter: AssetLibraryOrganizationFilter) => void;
    onRemoveCollection: (collection: string) => void;
    onRenameCollection: (oldCollection: string, newCollection: string) => void;
    summary: AssetLibraryOrganizationSummary;
    uiScale: number;
    visibleAssetCount: number;
};

export function AssetLibraryOrganizationPanel({
    busy,
    filter,
    isLoading,
    onAddCollectionToVisible,
    onFilterChange,
    onRemoveCollection,
    onRenameCollection,
    summary,
    uiScale,
    visibleAssetCount,
}: Properties) {
    const [draftCollection, setDraftCollection] = useState('');
    const [editingCollection, setEditingCollection] = useState<string>();
    const [editingDraft, setEditingDraft] = useState('');
    const hasOrganization = summary.collections.length > 0 || summary.tags.length > 0;
    const canAddCollection = draftCollection.trim().length > 0 && visibleAssetCount > 0 && !busy;

    const submitAddCollection = (event: FormEvent) => {
        event.preventDefault();
        const collection = draftCollection.trim();
        if (!collection || busy || visibleAssetCount === 0) return;
        onAddCollectionToVisible(collection);
        setDraftCollection('');
    };

    const startRename = (collection: string) => {
        setEditingCollection(collection);
        setEditingDraft(collection);
    };

    const submitRename = (oldCollection: string) => {
        const newCollection = editingDraft.trim();
        if (!newCollection || busy) return;
        onRenameCollection(oldCollection, newCollection);
        setEditingCollection(undefined);
        setEditingDraft('');
    };

    return (
        <>
            <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                Asset organization: {summary.tags.length} tag{summary.tags.length === 1 ? '' : 's'} | {summary.collections.length} collection{summary.collections.length === 1 ? '' : 's'} | Unorganized: {summary.unorganized}/{summary.total}
                {isLoading ? ' | Loading...' : ''}
            </div>

            <form onSubmit={submitAddCollection} style={collectionFormStyle(uiScale)}>
                <input
                    aria-label="Collection name for visible assets"
                    disabled={busy || visibleAssetCount === 0}
                    onChange={(event) => setDraftCollection(event.currentTarget.value)}
                    placeholder="Collection"
                    style={collectionInputStyle(uiScale)}
                    value={draftCollection}
                />
                <button
                    className="toolbar-btn"
                    disabled={!canAddCollection}
                    style={miniButtonStyle(uiScale, !canAddCollection)}
                    title="Add visible assets to collection"
                    type="submit"
                >
                    <Plus size={13 * uiScale} />
                    <span>Add visible ({visibleAssetCount})</span>
                </button>
            </form>

            {hasOrganization ? (
                <div style={kindSummaryRowStyle(uiScale)}>
                    <button
                        className="toolbar-btn"
                        onClick={() => onFilterChange({ kind: 'all' })}
                        style={kindSummaryChipStyle(uiScale, filter.kind === 'all')}
                        type="button"
                    >
                        All organization {summary.total}
                    </button>
                    {summary.collections.map((collectionSummary) => (
                        <CollectionSummaryControl
                            busy={busy}
                            editing={editingCollection === collectionSummary.label}
                            editingDraft={editingDraft}
                            filter={filter}
                            key={`collection-${collectionSummary.label}`}
                            onCancelEditing={() => {
                                setEditingCollection(undefined);
                                setEditingDraft('');
                            }}
                            onEditingDraftChange={setEditingDraft}
                            onFilterChange={onFilterChange}
                            onRemoveCollection={onRemoveCollection}
                            onRenameCollection={submitRename}
                            onStartRename={startRename}
                            summary={collectionSummary}
                            uiScale={uiScale}
                        />
                    ))}
                    {summary.tags.map((tagSummary) => (
                        <button
                            className="toolbar-btn"
                            key={`tag-${tagSummary.label}`}
                            onClick={() => onFilterChange(
                                filter.kind === 'tag' && filter.label === tagSummary.label
                                    ? { kind: 'all' }
                                    : { kind: 'tag', label: tagSummary.label },
                            )}
                            style={kindSummaryChipStyle(uiScale, filter.kind === 'tag' && filter.label === tagSummary.label)}
                            type="button"
                        >
                            #{tagSummary.label} {tagSummary.total}
                            <span style={{ color: t.text.faint }}>
                                {' '}({tagSummary.used}/{tagSummary.unused}/{tagSummary.missing})
                            </span>
                        </button>
                    ))}
                </div>
            ) : undefined}
        </>
    );
}

function CollectionSummaryControl({
    busy,
    editing,
    editingDraft,
    filter,
    onCancelEditing,
    onEditingDraftChange,
    onFilterChange,
    onRemoveCollection,
    onRenameCollection,
    onStartRename,
    summary,
    uiScale,
}: {
    busy: boolean;
    editing: boolean;
    editingDraft: string;
    filter: AssetLibraryOrganizationFilter;
    onCancelEditing: () => void;
    onEditingDraftChange: (value: string) => void;
    onFilterChange: (filter: AssetLibraryOrganizationFilter) => void;
    onRemoveCollection: (collection: string) => void;
    onRenameCollection: (oldCollection: string) => void;
    onStartRename: (collection: string) => void;
    summary: AssetLibraryOrganizationSummaryEntry;
    uiScale: number;
}) {
    const selected = filter.kind === 'collection' && filter.label === summary.label;

    if (editing) {
        return (
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    onRenameCollection(summary.label);
                }}
                style={collectionControlStyle(uiScale, selected)}
            >
                <input
                    aria-label={`Rename collection ${summary.label}`}
                    autoFocus
                    disabled={busy}
                    onChange={(event) => onEditingDraftChange(event.currentTarget.value)}
                    style={collectionInputStyle(uiScale)}
                    value={editingDraft}
                />
                <button
                    className="toolbar-btn"
                    disabled={busy || editingDraft.trim().length === 0}
                    style={iconButtonStyle(uiScale, busy || editingDraft.trim().length === 0)}
                    title="Save collection name"
                    type="submit"
                >
                    <Check size={13 * uiScale} />
                </button>
                <button
                    className="toolbar-btn"
                    disabled={busy}
                    onClick={onCancelEditing}
                    style={iconButtonStyle(uiScale, busy)}
                    title="Cancel rename"
                    type="button"
                >
                    <X size={13 * uiScale} />
                </button>
            </form>
        );
    }

    return (
        <span style={collectionControlStyle(uiScale, selected)}>
            <button
                className="toolbar-btn"
                onClick={() => onFilterChange(selected ? { kind: 'all' } : { kind: 'collection', label: summary.label })}
                style={collectionFilterButtonStyle(uiScale)}
                type="button"
            >
                {summary.label} {summary.total}
                <span style={{ color: t.text.faint }}>
                    {' '}({summary.used}/{summary.unused}/{summary.missing})
                </span>
            </button>
            <button
                className="toolbar-btn"
                disabled={busy}
                onClick={() => onStartRename(summary.label)}
                style={iconButtonStyle(uiScale, busy)}
                title={`Rename collection ${summary.label}`}
                type="button"
            >
                <Pencil size={13 * uiScale} />
            </button>
            <button
                className="toolbar-btn"
                disabled={busy}
                onClick={() => onRemoveCollection(summary.label)}
                style={iconButtonStyle(uiScale, busy)}
                title={`Remove collection ${summary.label}`}
                type="button"
            >
                <Trash2 size={13 * uiScale} />
            </button>
        </span>
    );
}

function collectionControlStyle(uiScale: number, selected: boolean) {
    return {
        alignItems: 'center',
        background: selected ? t.bg.selected : t.bg.panel,
        border: `1px solid ${selected ? t.accent.primary : t.border.subtle}`,
        borderRadius: t.radius.sm,
        display: 'inline-flex',
        gap: `${2 * uiScale}px`,
        padding: `${2 * uiScale}px`,
    };
}

function collectionFilterButtonStyle(uiScale: number) {
    return {
        border: 'none',
        color: t.text.normal,
        cursor: 'pointer',
        fontSize: `${11 * uiScale}px`,
        padding: `${2 * uiScale}px ${4 * uiScale}px`,
        whiteSpace: 'nowrap' as const,
    };
}

function collectionFormStyle(uiScale: number) {
    return {
        alignItems: 'center',
        display: 'flex',
        flexWrap: 'wrap' as const,
        gap: `${6 * uiScale}px`,
    };
}

function collectionInputStyle(uiScale: number) {
    return {
        ...searchInputStyle(uiScale),
        background: t.bg.input,
        border: `1px solid ${t.border.input}`,
        borderRadius: t.radius.sm,
        flex: '0 1 180px',
        minHeight: `${24 * uiScale}px`,
        padding: `${3 * uiScale}px ${6 * uiScale}px`,
    };
}

function iconButtonStyle(uiScale: number, disabled: boolean) {
    return {
        alignItems: 'center',
        border: 'none',
        color: disabled ? t.text.faint : t.text.normal,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        justifyContent: 'center',
        minHeight: `${22 * uiScale}px`,
        minWidth: `${22 * uiScale}px`,
        padding: `${2 * uiScale}px`,
    };
}
