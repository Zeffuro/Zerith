import type { EvidenceItem, Serializable } from 'core';
import type { CSSProperties } from 'react';

import { Plus, RefreshCcw, Save, Trash2, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useEditorStore } from '../../store/useEditorStore';
import { useEngineBridgeStore } from '../../store/useEngineBridgeStore';
import { useProjectStore } from '../../store/useProjectStore';
import { editorTheme as t } from '../../theme/editorTheme';

type ObserverSnapshot = {
    items: EvidenceItem[];
    state: Record<string, Serializable>;
};

type DraftValueKind = 'boolean' | 'json' | 'null' | 'number' | 'string';

type StateDraftRow = {
    id: string;
    key: string;
    valueText: string;
};

type ItemDraftRow = {
    customJson: string;
    description: string;
    id: string;
    imageUrl: string;
    itemId: string;
    name: string;
    type: string;
};

const EMPTY_SNAPSHOT: ObserverSnapshot = {
    items: [],
    state: {},
};

export function StateObserverPanel() {
    const uiScale = useEditorStore((state) => state.uiScale);
    const engine = useEngineBridgeStore((state) => state.engine);
    const projectItems = useProjectStore((state) => state.items);

    const knownItemIds = useMemo(() => new Set(Object.keys(projectItems)), [projectItems]);

    const [snapshot, setSnapshot] = useState<ObserverSnapshot>(EMPTY_SNAPSHOT);
    const [stateDraftRows, setStateDraftRows] = useState<StateDraftRow[]>([]);
    const [itemDraftRows, setItemDraftRows] = useState<ItemDraftRow[]>([]);
    const [hasDraftChanges, setHasDraftChanges] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | undefined>();

    const hasDraftChangesReference = useRef(false);
    const snapshotSignatureReference = useRef('');
    const rowCounterReference = useRef(0);

    const nextRowId = () => {
        rowCounterReference.current += 1;
        return `row-${rowCounterReference.current}`;
    };

    const applySnapshotToDrafts = (nextSnapshot: ObserverSnapshot) => {
        setStateDraftRows(
            Object.entries(nextSnapshot.state).map(([key, value]) => ({
                id: nextRowId(),
                key,
                valueText: JSON.stringify(value),
            }))
        );

        setItemDraftRows(nextSnapshot.items.map((item) => toItemDraftRow(item, nextRowId())));
    };

    useEffect(() => {
        if (!engine) {
            setSnapshot(EMPTY_SNAPSHOT);
            setStateDraftRows([]);
            setItemDraftRows([]);
            setHasDraftChanges(false);
            setStatusMessage(undefined);
            hasDraftChangesReference.current = false;
            snapshotSignatureReference.current = '';
            return;
        }

        const pullSnapshot = () => {
            const nextSnapshot: ObserverSnapshot = {
                items: engine.items.getAll(),
                state: engine.stateManager.state,
            };

            const nextSignature = JSON.stringify(nextSnapshot);
            if (nextSignature === snapshotSignatureReference.current) return;

            snapshotSignatureReference.current = nextSignature;
            setSnapshot(nextSnapshot);

            if (!hasDraftChangesReference.current) {
                applySnapshotToDrafts(nextSnapshot);
            }
        };

        pullSnapshot();
        const interval = globalThis.setInterval(pullSnapshot, 200);
        return () => {
            globalThis.clearInterval(interval);
        };
    }, [engine]);

    if (!engine) {
        return <div style={{ color: t.text.faint, fontStyle: 'italic', padding: `${12 * uiScale}px` }}>Game preview not running.</div>;
    }

    const markDirty = () => {
        hasDraftChangesReference.current = true;
        setHasDraftChanges(true);
        setStatusMessage(undefined);
    };

    const syncFromRuntime = (nextMessage: string) => {
        const nextSnapshot: ObserverSnapshot = {
            items: engine.items.getAll(),
            state: engine.stateManager.state,
        };
        setSnapshot(nextSnapshot);
        snapshotSignatureReference.current = JSON.stringify(nextSnapshot);
        applySnapshotToDrafts(nextSnapshot);
        hasDraftChangesReference.current = false;
        setHasDraftChanges(false);
        setStatusMessage(nextMessage);
    };

    const addStateRow = () => {
        setStateDraftRows((rows) => [...rows, { id: nextRowId(), key: '', valueText: 'null' }]);
        markDirty();
    };

    const addItemRow = () => {
        setItemDraftRows((rows) => [
            ...rows,
            {
                customJson: '{}',
                description: '',
                id: nextRowId(),
                imageUrl: '',
                itemId: '',
                name: '',
                type: 'evidence',
            },
        ]);
        markDirty();
    };

    const resetDraft = () => {
        applySnapshotToDrafts(snapshot);
        hasDraftChangesReference.current = false;
        setHasDraftChanges(false);
        setStatusMessage('Draft reset to latest preview snapshot.');
    };

    const reloadFromLive = () => {
        syncFromRuntime('Reloaded from preview runtime.');
    };

    const applyStateRow = (rowId: string): boolean => {
        const row = stateDraftRows.find((candidate) => candidate.id === rowId);
        if (!row) return false;

        const key = row.key.trim();
        if (!key) {
            setStatusMessage('Cannot apply state row: key cannot be empty.');
            return false;
        }

        const parsedValue = parseJsonValue(row.valueText);
        if (parsedValue === undefined) {
            setStatusMessage(`Cannot apply state row '${key}': invalid JSON value.`);
            return false;
        }

        engine.stateManager.set(key, parsedValue);
        syncFromRuntime(`Applied state key '${key}'.`);
        return true;
    };

    const applyItemRow = (rowId: string): boolean => {
        const row = itemDraftRows.find((candidate) => candidate.id === rowId);
        if (!row) return false;

        const itemId = row.itemId.trim();
        if (!itemId) {
            setStatusMessage('Cannot apply item row: item id cannot be empty.');
            return false;
        }

        if (!knownItemIds.has(itemId)) {
            setStatusMessage(`Cannot apply item row '${itemId}': unknown item id.`);
            return false;
        }

        const custom = parseJsonObject(row.customJson);
        if (!custom) {
            setStatusMessage(`Cannot apply item row '${itemId}': custom fields must be a JSON object.`);
            return false;
        }

        const payload: Partial<Omit<EvidenceItem, 'id'>> = {
            ...custom,
            description: row.description,
            imageUrl: row.imageUrl.trim() || undefined,
            name: row.name,
            type: row.type === 'profile' ? 'profile' : 'evidence',
        };

        if (!engine.items.has(itemId) && !engine.items.add(itemId)) {
            setStatusMessage(`Cannot apply item row '${itemId}': item could not be added to inventory.`);
            return false;
        }

        engine.items.update(itemId, payload);
        syncFromRuntime(`Applied inventory item '${itemId}'.`);
        return true;
    };

    const applyDraft = () => {
        const nextState: Record<string, Serializable> = {};
        const usedStateKeys = new Set<string>();

        for (const row of stateDraftRows) {
            const key = row.key.trim();
            if (!key) {
                setStatusMessage('Cannot apply: state key cannot be empty.');
                return;
            }
            if (usedStateKeys.has(key)) {
                setStatusMessage(`Cannot apply: duplicate state key '${key}'.`);
                return;
            }

            const parsedValue = parseJsonValue(row.valueText);
            if (parsedValue === undefined) {
                setStatusMessage(`Cannot apply: invalid JSON for state key '${key}'.`);
                return;
            }

            usedStateKeys.add(key);
            nextState[key] = parsedValue;
        }

        const parsedItems: Array<{ id: string; payload: Partial<Omit<EvidenceItem, 'id'>>; }> = [];
        for (const row of itemDraftRows) {
            const itemId = row.itemId.trim();
            if (!itemId) {
                setStatusMessage('Cannot apply: item id cannot be empty.');
                return;
            }
            if (!knownItemIds.has(itemId)) {
                setStatusMessage(`Cannot apply: unknown item id '${itemId}'.`);
                return;
            }

            const custom = parseJsonObject(row.customJson);
            if (!custom) {
                setStatusMessage(`Cannot apply: custom fields for '${itemId}' must be a JSON object.`);
                return;
            }

            parsedItems.push({
                id: itemId,
                payload: {
                    ...custom,
                    description: row.description,
                    imageUrl: row.imageUrl.trim() || undefined,
                    name: row.name,
                    type: row.type === 'profile' ? 'profile' : 'evidence',
                },
            });
        }

        const currentState = engine.stateManager.state;
        for (const existingKey of Object.keys(currentState)) {
            if (!(existingKey in nextState)) {
                engine.stateManager.set(existingKey, undefined);
            }
        }
        for (const [key, value] of Object.entries(nextState)) {
            engine.stateManager.set(key, value);
        }

        engine.items.clear();
        for (const entry of parsedItems) {
            if (!engine.items.add(entry.id)) {
                setStatusMessage(`Cannot apply: failed to add item '${entry.id}'.`);
                return;
            }
            engine.items.update(entry.id, entry.payload);
        }

        syncFromRuntime('Applied full draft to preview runtime.');
    };

    return (
        <div
            className="zerith-scrollbar"
            style={{
                background: t.bg.app,
                color: t.text.normal,
                display: 'flex',
                flexDirection: 'column',
                fontSize: `${11 * uiScale}px`,
                height: '100%',
                overflow: 'auto',
                padding: `${10 * uiScale}px`,
            }}
        >
            <div style={{ alignItems: 'center', display: 'flex', gap: `${6 * uiScale}px`, marginBottom: `${8 * uiScale}px` }}>
                <button className="toolbar-btn primary" onClick={applyDraft} style={{ padding: `${4 * uiScale}px ${8 * uiScale}px` }} title="Apply all rows">
                    <Save size={13 * uiScale} /> Apply All
                </button>
                <button className="toolbar-btn" onClick={resetDraft} style={{ padding: `${4 * uiScale}px ${8 * uiScale}px` }} title="Reset draft to current snapshot">
                    <RefreshCcw size={13 * uiScale} /> Reset
                </button>
                <button className="toolbar-btn" onClick={reloadFromLive} style={{ padding: `${4 * uiScale}px ${8 * uiScale}px` }} title="Reload from running preview">
                    <RefreshCcw size={13 * uiScale} /> Reload
                </button>
                <span style={{ color: hasDraftChanges ? '#fbbf24' : t.text.muted, marginLeft: 'auto' }}>
                    {hasDraftChanges ? 'Unsaved changes' : 'Synced'}
                </span>
            </div>

            {statusMessage && <div style={{ color: t.text.muted, marginBottom: `${8 * uiScale}px` }}>{statusMessage}</div>}

            <section style={sectionStyle(uiScale)}>
                <div style={{ alignItems: 'center', display: 'flex', marginBottom: `${6 * uiScale}px` }}>
                    <strong>State Variables</strong>
                    <button className="toolbar-btn" onClick={addStateRow} style={{ marginLeft: 'auto', padding: `${2 * uiScale}px ${6 * uiScale}px` }}>
                        <Plus size={12 * uiScale} /> Add
                    </button>
                </div>

                {stateDraftRows.length === 0 && <div style={{ color: t.text.faint, fontStyle: 'italic' }}>No state keys.</div>}

                {stateDraftRows.map((row) => (
                    <div key={row.id} style={{ borderTop: `1px solid ${t.border.subtle}`, display: 'grid', gap: `${6 * uiScale}px`, gridTemplateColumns: '160px 1fr auto auto', padding: `${6 * uiScale}px 0` }}>
                        <input
                            onChange={(event) => {
                                const next = event.target.value;
                                setStateDraftRows((rows) => rows.map((candidate) => (candidate.id === row.id ? { ...candidate, key: next } : candidate)));
                                markDirty();
                            }}
                            placeholder="state key"
                            style={inputStyle(uiScale)}
                            type="text"
                            value={row.key}
                        />

                        <StateValueEditor
                            onChange={(next) => {
                                setStateDraftRows((rows) => rows.map((candidate) => (candidate.id === row.id ? { ...candidate, valueText: next } : candidate)));
                                markDirty();
                            }}
                            uiScale={uiScale}
                            valueText={row.valueText}
                        />

                        <button
                            className="toolbar-btn"
                            onClick={() => {
                                void applyStateRow(row.id);
                            }}
                            style={{ padding: `${4 * uiScale}px` }}
                            title="Apply this row"
                        >
                            <Zap size={12 * uiScale} />
                        </button>

                        <button
                            className="toolbar-btn"
                            onClick={() => {
                                setStateDraftRows((rows) => rows.filter((candidate) => candidate.id !== row.id));
                                markDirty();
                            }}
                            style={{ padding: `${4 * uiScale}px` }}
                            title="Remove state row"
                        >
                            <Trash2 size={12 * uiScale} />
                        </button>
                    </div>
                ))}
            </section>

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
                                    void applyItemRow(row.id);
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
                    {Array.from(knownItemIds).map((itemId) => <option key={itemId} value={itemId} />)}
                </datalist>
            </section>
        </div>
    );
}

function StateValueEditor({ onChange, uiScale, valueText }: { onChange: (next: string) => void; uiScale: number; valueText: string; }) {
    const kind = detectDraftValueKind(valueText);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${4 * uiScale}px` }}>
            <div style={{ alignItems: 'center', display: 'flex', gap: `${6 * uiScale}px` }}>
                <span style={{ color: t.text.muted }}>Type</span>
                <select
                    onChange={(event) => onChange(defaultValueForKind(event.target.value as DraftValueKind))}
                    style={{ ...inputStyle(uiScale), maxWidth: 130, padding: `${2 * uiScale}px ${6 * uiScale}px` }}
                    value={kind}
                >
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="null">null</option>
                    <option value="json">json</option>
                </select>
            </div>

            {kind === 'boolean' ? (
                <select
                    onChange={(event) => onChange(event.target.value === 'true' ? 'true' : 'false')}
                    style={inputStyle(uiScale)}
                    value={valueText === 'true' ? 'true' : 'false'}
                >
                    <option value="true">true</option>
                    <option value="false">false</option>
                </select>
            ) : kind === 'number' ? (
                <input
                    onChange={(event) => onChange(event.target.value)}
                    style={inputStyle(uiScale)}
                    type="number"
                    value={valueText}
                />
            ) : kind === 'string' ? (
                <input
                    onChange={(event) => onChange(JSON.stringify(event.target.value))}
                    style={inputStyle(uiScale)}
                    type="text"
                    value={safeStringValue(valueText)}
                />
            ) : kind === 'null' ? (
                <div style={{ color: t.text.faint, fontStyle: 'italic', padding: `${4 * uiScale}px 0` }}>null</div>
            ) : (
                <textarea
                    onChange={(event) => onChange(event.target.value)}
                    rows={2}
                    style={textareaStyle(uiScale)}
                    value={valueText}
                />
            )}
        </div>
    );
}

function toItemDraftRow(item: EvidenceItem, rowId: string): ItemDraftRow {
    const { description, id, imageUrl, name, type, ...custom } = item;
    return {
        customJson: JSON.stringify(custom, undefined, 0),
        description,
        id: rowId,
        imageUrl: typeof imageUrl === 'string' ? imageUrl : '',
        itemId: id,
        name,
        type: type === 'profile' ? 'profile' : 'evidence',
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

function textareaStyle(uiScale: number): CSSProperties {
    return {
        ...inputStyle(uiScale),
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        resize: 'vertical',
    };
}

function parseJsonObject(raw: string): Record<string, unknown> | undefined {
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return undefined;
        }
        return parsed as Record<string, unknown>;
    } catch {
        return undefined;
    }
}

function parseJsonValue(raw: string): Serializable | undefined {
    try {
        const parsed: unknown = JSON.parse(raw);
        return isSerializable(parsed) ? parsed : undefined;
    } catch {
        return undefined;
    }
}

function isSerializable(value: unknown): value is Serializable {
    if (value === null) return true;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;
    if (Array.isArray(value)) return value.every((entry) => isSerializable(entry));
    if (typeof value === 'object') {
        return Object.values(value as Record<string, unknown>).every((entry) => isSerializable(entry));
    }
    return false;
}

function detectDraftValueKind(valueText: string): DraftValueKind {
    const parsed = parseJsonUnknown(valueText);
    if (parsed === undefined) return 'json';
    if (parsed === null) return 'null';
    if (typeof parsed === 'boolean') return 'boolean';
    if (typeof parsed === 'number') return 'number';
    if (typeof parsed === 'string') return 'string';
    return 'json';
}

function defaultValueForKind(kind: DraftValueKind): string {
    switch (kind) {
        case 'boolean':
            return 'false';
        case 'null':
            return 'null';
        case 'number':
            return '0';
        case 'string':
            return '""';
        case 'json':
            return '{}';
    }
}

function parseJsonUnknown(raw: string): unknown {
    try {
        return JSON.parse(raw);
    } catch {
        return undefined;
    }
}

function safeStringValue(valueText: string): string {
    const parsed = parseJsonUnknown(valueText);
    return typeof parsed === 'string' ? parsed : '';
}
