import type { EvidenceItem, Serializable } from 'core';

import { RefreshCcw, Save } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useProjectStore } from '../../store/storeBootstrap';
import { useEditorStore } from '../../store/useEditorStore';
import { useEngineBridgeStore } from '../../store/useEngineBridgeStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { StateObserverItems } from './StateObserverItems';
import {
    EMPTY_SNAPSHOT,
    type ItemDraftRow,
    type ObserverSnapshot,
    parseDraftValue,
    snapshotSignature,
    type StateDraftRow,
    toItemDraftRow,
    toItemPayload,
} from './stateObserverModel';
import { StateObserverVariables } from './StateObserverVariables';

type ObserverTab = 'items' | 'state';

export function StateObserverPanel() {
    const uiScale = useEditorStore((state) => state.uiScale);
    const engine = useEngineBridgeStore((state) => state.engine);
    const projectItems = useProjectStore((state) => state.items);

    const knownItemIds = useMemo(() => new Set(Object.keys(projectItems)), [projectItems]);

    const [activeTab, setActiveTab] = useState<ObserverTab>('state');
    const [snapshot, setSnapshot] = useState<ObserverSnapshot>(EMPTY_SNAPSHOT);
    const [stateDraftRows, setStateDraftRows] = useState<StateDraftRow[]>([]);
    const [itemDraftRows, setItemDraftRows] = useState<ItemDraftRow[]>([]);
    const [hasDraftChanges, setHasDraftChanges] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | undefined>();

    const hasDraftChangesReference = useRef(false);
    const snapshotSignatureReference = useRef('');
    const rowCounterReference = useRef(0);

    const nextRowId = useCallback(() => {
        rowCounterReference.current += 1;
        return `row-${rowCounterReference.current}`;
    }, []);

    const applySnapshotToDrafts = useCallback((nextSnapshot: ObserverSnapshot) => {
        setStateDraftRows(
            Object.entries(nextSnapshot.state).map(([key, value]) => ({
                id: nextRowId(),
                key,
                valueText: JSON.stringify(value),
            }))
        );

        setItemDraftRows(nextSnapshot.items.map((item) => toItemDraftRow(item, nextRowId())));
    }, [nextRowId]);

    useEffect(() => {
        if (!engine) {
            hasDraftChangesReference.current = false;
            snapshotSignatureReference.current = '';
            return;
        }

        const pullSnapshot = () => {
            const nextSnapshot: ObserverSnapshot = {
                items: engine.items.getAll(),
                state: engine.stateManager.state,
            };

            const nextSignature = snapshotSignature(nextSnapshot);
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
    }, [applySnapshotToDrafts, engine]);

    const markDirty = useCallback(() => {
        hasDraftChangesReference.current = true;
        setHasDraftChanges(true);
        setStatusMessage(undefined);
    }, []);

    if (!engine) {
        return <div style={{ color: t.text.faint, fontStyle: 'italic', padding: `${12 * uiScale}px` }}>Game preview not running.</div>;
    }

    const syncFromRuntime = (nextMessage: string) => {
        const nextSnapshot: ObserverSnapshot = {
            items: engine.items.getAll(),
            state: engine.stateManager.state,
        };
        setSnapshot(nextSnapshot);
        snapshotSignatureReference.current = snapshotSignature(nextSnapshot);
        applySnapshotToDrafts(nextSnapshot);
        hasDraftChangesReference.current = false;
        setHasDraftChanges(false);
        setStatusMessage(nextMessage);
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

    const applyStateRow = (rowId: string) => {
        const row = stateDraftRows.find((candidate) => candidate.id === rowId);
        if (!row) return;

        const key = row.key.trim();
        if (!key) {
            setStatusMessage('Cannot apply state row: key cannot be empty.');
            return;
        }

        const parsedValue = parseDraftValue(row.valueText);
        if (parsedValue === undefined) {
            setStatusMessage(`Cannot apply state row '${key}': invalid JSON value.`);
            return;
        }

        engine.stateManager.set(key, parsedValue);
        syncFromRuntime(`Applied state key '${key}'.`);
    };

    const applyItemRow = (rowId: string) => {
        const row = itemDraftRows.find((candidate) => candidate.id === rowId);
        if (!row) return;

        const itemId = row.itemId.trim();
        if (!itemId) {
            setStatusMessage('Cannot apply item row: item id cannot be empty.');
            return;
        }

        if (!knownItemIds.has(itemId)) {
            setStatusMessage(`Cannot apply item row '${itemId}': unknown item id.`);
            return;
        }

        const payload = toItemPayload(row);
        if (!payload) {
            setStatusMessage(`Cannot apply item row '${itemId}': custom fields must be a JSON object.`);
            return;
        }

        if (!engine.items.has(itemId) && !engine.items.add(itemId)) {
            setStatusMessage(`Cannot apply item row '${itemId}': item could not be added to inventory.`);
            return;
        }

        engine.items.update(itemId, payload);
        syncFromRuntime(`Applied inventory item '${itemId}'.`);
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

            const parsedValue = parseDraftValue(row.valueText);
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

            const payload = toItemPayload(row);
            if (!payload) {
                setStatusMessage(`Cannot apply: custom fields for '${itemId}' must be a JSON object.`);
                return;
            }

            parsedItems.push({ id: itemId, payload });
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

            <div style={{ display: 'flex', gap: `${6 * uiScale}px`, marginBottom: `${8 * uiScale}px` }}>
                <button className={activeTab === 'state' ? 'toolbar-btn primary' : 'toolbar-btn'} onClick={() => setActiveTab('state')} style={{ padding: `${3 * uiScale}px ${8 * uiScale}px` }}>
                    State
                </button>
                <button className={activeTab === 'items' ? 'toolbar-btn primary' : 'toolbar-btn'} onClick={() => setActiveTab('items')} style={{ padding: `${3 * uiScale}px ${8 * uiScale}px` }}>
                    Items
                </button>
            </div>

            {statusMessage && <div style={{ color: t.text.muted, marginBottom: `${8 * uiScale}px` }}>{statusMessage}</div>}

            {activeTab === 'state' ? (
                <StateObserverVariables
                    onApplyStateRow={applyStateRow}
                    onDirty={markDirty}
                    onGenerateRowId={nextRowId}
                    setHasDraftChanges={setHasDraftChanges}
                    setStateDraftRows={setStateDraftRows}
                    stateDraftRows={stateDraftRows}
                    uiScale={uiScale}
                />
            ) : (
                <StateObserverItems
                    itemDraftRows={itemDraftRows}
                    knownItemIds={knownItemIds}
                    onApplyItemRow={applyItemRow}
                    onDirty={markDirty}
                    onGenerateRowId={nextRowId}
                    setHasDraftChanges={setHasDraftChanges}
                    setItemDraftRows={setItemDraftRows}
                    uiScale={uiScale}
                />
            )}
        </div>
    );
}

