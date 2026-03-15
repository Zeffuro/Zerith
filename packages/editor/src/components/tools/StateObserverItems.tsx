import type { CSSProperties, Dispatch, SetStateAction } from 'react';

import { Plus, Trash2, Zap } from 'lucide-react';

import type { ItemDraftRow } from './stateObserverModel';

import { editorTheme as t } from '../../theme/editorTheme';

type StateObserverItemsProperties = {
    itemDraftRows: ItemDraftRow[];
    knownItemIds: Set<string>;
    onApplyItemRow: (rowId: string) => void;
    onDirty: () => void;
    onGenerateRowId: () => string;
    setHasDraftChanges: Dispatch<SetStateAction<boolean>>;
    setItemDraftRows: Dispatch<SetStateAction<ItemDraftRow[]>>;
    uiScale: number;
};

export function StateObserverItems({
    itemDraftRows,
    knownItemIds,
    onApplyItemRow,
    onDirty,
    onGenerateRowId,
    setHasDraftChanges,
    setItemDraftRows,
    uiScale,
}: StateObserverItemsProperties) {
    const markDirty = () => {
        setHasDraftChanges(true);
        onDirty();
    };

    const addItemRow = () => {
        setItemDraftRows((rows) => [
            ...rows,
            {
                customJson: '{}',
                description: '',
                id: onGenerateRowId(),
                imageUrl: '',
                itemId: '',
                name: '',
                type: 'evidence',
            },
        ]);
        markDirty();
    };

    return (
        <section style={sectionStyle(uiScale)}>
            <div style={{ alignItems: 'center', display: 'flex', marginBottom: `${6 * uiScale}px` }}>
                <strong>Inventory Items</strong>
                <button className="toolbar-btn" onClick={addItemRow} style={{ marginLeft: 'auto', padding: `${2 * uiScale}px ${6 * uiScale}px` }}>
                    <Plus size={12 * uiScale} /> Add
                </button>
            </div>

            {itemDraftRows.length === 0 && <div style={{ color: t.text.faint, fontStyle: 'italic' }}>No items in inventory.</div>}

            {itemDraftRows.map((row) => (
                <div key={row.id} style={{ borderTop: `1px solid ${t.border.subtle}`, display: 'flex', flexDirection: 'column', gap: `${6 * uiScale}px`, padding: `${8 * uiScale}px 0` }}>
                    <div style={{ display: 'grid', gap: `${6 * uiScale}px`, gridTemplateColumns: '170px 1fr 1fr auto auto' }}>
                        <input
                            list="state-observer-item-ids"
                            onChange={(event) => {
                                const next = event.target.value;
                                setItemDraftRows((rows) => rows.map((candidate) => (candidate.id === row.id ? { ...candidate, itemId: next } : candidate)));
                                markDirty();
                            }}
                            placeholder="item id"
                            style={inputStyle(uiScale)}
                            type="text"
                            value={row.itemId}
                        />

                        <input
                            onChange={(event) => {
                                const next = event.target.value;
                                setItemDraftRows((rows) => rows.map((candidate) => (candidate.id === row.id ? { ...candidate, name: next } : candidate)));
                                markDirty();
                            }}
                            placeholder="name"
                            style={inputStyle(uiScale)}
                            type="text"
                            value={row.name}
                        />

                        <select
                            onChange={(event) => {
                                const next = event.target.value;
                                setItemDraftRows((rows) => rows.map((candidate) => (candidate.id === row.id ? { ...candidate, type: next } : candidate)));
                                markDirty();
                            }}
                            style={inputStyle(uiScale)}
                            value={row.type}
                        >
                            <option value="evidence">evidence</option>
                            <option value="profile">profile</option>
                        </select>

                        <button
                            className="toolbar-btn"
                            onClick={() => {
                                onApplyItemRow(row.id);
                            }}
                            style={{ padding: `${4 * uiScale}px` }}
                            title="Apply this item"
                        >
                            <Zap size={12 * uiScale} />
                        </button>

                        <button
                            className="toolbar-btn"
                            onClick={() => {
                                setItemDraftRows((rows) => rows.filter((candidate) => candidate.id !== row.id));
                                markDirty();
                            }}
                            style={{ padding: `${4 * uiScale}px` }}
                            title="Remove item row"
                        >
                            <Trash2 size={12 * uiScale} />
                        </button>
                    </div>

                    <textarea
                        onChange={(event) => {
                            const next = event.target.value;
                            setItemDraftRows((rows) => rows.map((candidate) => (candidate.id === row.id ? { ...candidate, description: next } : candidate)));
                            markDirty();
                        }}
                        placeholder="description"
                        rows={2}
                        style={textareaStyle(uiScale)}
                        value={row.description}
                    />

                    <input
                        onChange={(event) => {
                            const next = event.target.value;
                            setItemDraftRows((rows) => rows.map((candidate) => (candidate.id === row.id ? { ...candidate, imageUrl: next } : candidate)));
                            markDirty();
                        }}
                        placeholder="imageUrl (optional)"
                        style={inputStyle(uiScale)}
                        type="text"
                        value={row.imageUrl}
                    />

                    <textarea
                        onChange={(event) => {
                            const next = event.target.value;
                            setItemDraftRows((rows) => rows.map((candidate) => (candidate.id === row.id ? { ...candidate, customJson: next } : candidate)));
                            markDirty();
                        }}
                        placeholder="custom fields as JSON object"
                        rows={2}
                        style={textareaStyle(uiScale)}
                        value={row.customJson}
                    />
                </div>
            ))}

            <datalist id="state-observer-item-ids">
                {[...knownItemIds].map((itemId) => <option key={itemId} value={itemId} />)}
            </datalist>
        </section>
    );
}

function inputStyle(uiScale: number): CSSProperties {
    return {
        background: t.bg.input,
        border: `1px solid ${t.border.input}`,
        borderRadius: t.radius.sm,
        color: t.text.primary,
        fontSize: `${11 * uiScale}px`,
        minWidth: 0,
        padding: `${4 * uiScale}px ${6 * uiScale}px`,
        width: '100%',
    };
}

function sectionStyle(uiScale: number): CSSProperties {
    return {
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.md,
        marginBottom: `${10 * uiScale}px`,
        padding: `${8 * uiScale}px`,
    };
}

function textareaStyle(uiScale: number): CSSProperties {
    return {
        ...inputStyle(uiScale),
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        resize: 'vertical',
    };
}

