import type { ItemManifestEntry } from 'core';

import { useMemo, useState } from 'react';

import { fsWriteTextFile } from '../../../services/fs';
import { useProjectStore } from '../../../store/storeBootstrap';
import { useWorkbenchStore } from '../../../store/useWorkbenchStore';
import { editorTheme as t } from '../../../theme/editorTheme';
import { Field, isRecord, sharedStyles } from './EditorSharedUI';

type ActiveTab = ReturnType<typeof useWorkbenchStore.getState>['tabs'][number] | undefined;
type ItemsMap = Record<string, ItemManifestEntry>;

type ParsedItemsTab = {
    baseRoot: Record<string, unknown>;
    error?: string;
    items: ItemsMap;
    schema?: string;
};

export function ItemsEditor({ uiScale }: { uiScale: number }) {
    const activeTab = useWorkbenchStore((state) => state.activeTab());
    const updateTabContent = useWorkbenchStore((state) => state.updateTabContent);
    const clearFileDirty = useProjectStore((state) => state.clearFileDirty);

    const [selectedByTab, setSelectedByTab] = useState<Record<string, string>>({});
    const[runtimeError, setRuntimeError] = useState<string>();
    const [status, setStatus] = useState('');

    const parsedTab = useMemo(() => parseActiveTab(activeTab), [activeTab]);
    const tabId = activeTab?.id;
    const items = parsedTab.items;
    const itemIds = useMemo(() => Object.keys(items), [items]);
    const selectedItemId =
        tabId && selectedByTab[tabId] && items[selectedByTab[tabId]]
            ? selectedByTab[tabId]
            : (itemIds[0] ?? '');
    const selectedItem = selectedItemId ? items[selectedItemId] : undefined;

    const setItems = (updater: (current: ItemsMap) => ItemsMap) => {
        if (!tabId || !activeTab || activeTab.kind !== 'items') return;
        const nextItems = updater(parsedTab.items);
        const nextText = serializeItems(nextItems, parsedTab.baseRoot, parsedTab.schema);
        updateTabContent(tabId, nextText);
        setRuntimeError(undefined);
        setStatus('');
    };

    const setSelectedItemId = (nextId: string) => {
        if (!tabId) return;
        setSelectedByTab((previous) => ({ ...previous, [tabId]: nextId }));
    };

    const addItem = () => {
        const nextId = makeNextId('item', itemIds);
        setItems((current) => ({
            ...current,
            [nextId]: {
                description: '',
                name: nextId,
                type: 'evidence',
            },
        }));
        setSelectedItemId(nextId);
    };

    const updateSelected = (patch: Partial<ItemManifestEntry>) => {
        if (!selectedItemId) return;
        setItems((current) => ({
            ...current,
            [selectedItemId]: {
                ...current[selectedItemId],
                ...patch,
            },
        }));
    };

    const apply = async () => {
        if (!activeTab || activeTab.kind !== 'items') return;
        try {
            const nextText = activeTab.textContent ?? '{}';
            await fsWriteTextFile(activeTab.path, nextText);
            updateTabContent(activeTab.id, nextText, { markDirty: false });
            clearFileDirty(activeTab.path);
            setStatus('Saved items.');
            setRuntimeError(undefined);
        } catch (caughtError: unknown) {
            setRuntimeError(caughtError instanceof Error ? caughtError.message : 'Failed to save items file');
        }
    };

    const message = runtimeError ?? parsedTab.error ?? status;

    return (
        <div style={{ display: 'grid', gap: `${10 * uiScale}px`, gridTemplateRows: '1fr auto', height: '100%', padding: `${10 * uiScale}px` }}>
            <div style={{ display: 'grid', gap: `${10 * uiScale}px`, gridTemplateColumns: '280px 1fr', minHeight: 0 }}>
                <div style={sharedStyles.panel(uiScale)}>
                    <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
                        <strong>Items</strong>
                        <button onClick={addItem} style={sharedStyles.secondaryButton(uiScale)}>
                            + Add Item
                        </button>
                    </div>
                    <div style={{ display: 'grid', gap: `${6 * uiScale}px`, marginTop: `${8 * uiScale}px`, overflow: 'auto' }}>
                        {itemIds.map((itemId) => (
                            <button key={itemId} onClick={() => setSelectedItemId(itemId)} style={sharedStyles.rowActive(itemId === selectedItemId, uiScale)}>
                                {itemId}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={sharedStyles.panel(uiScale)}>
                    {selectedItem ? (
                        <div style={{ display: 'grid', gap: `${10 * uiScale}px` }}>
                            <Field label="Name">
                                <input onChange={(event) => updateSelected({ name: event.target.value })} style={sharedStyles.input(uiScale)} value={selectedItem.name ?? ''} />
                            </Field>
                            <Field label="Type">
                                <select
                                    onChange={(event) => updateSelected({ type: event.target.value || undefined })}
                                    style={sharedStyles.input(uiScale)}
                                    value={typeof selectedItem.type === 'string' ? selectedItem.type : ''}
                                >
                                    <option value="">(none)</option>
                                    <option value="evidence">evidence</option>
                                    <option value="profile">profile</option>
                                </select>
                            </Field>
                            <Field label="Image URL">
                                <input onChange={(event) => updateSelected({ imageUrl: event.target.value || undefined })} style={sharedStyles.input(uiScale)} value={selectedItem.imageUrl ?? ''} />
                            </Field>
                            <Field label="Description">
                                <textarea
                                    onChange={(event) => updateSelected({ description: event.target.value })}
                                    rows={7}
                                    style={sharedStyles.textArea(uiScale)}
                                    value={selectedItem.description ?? ''}
                                />
                            </Field>
                        </div>
                    ) : (
                        <span style={{ color: t.text.muted }}>Select an item to edit.</span>
                    )}
                </div>
            </div>

            <div style={{ alignItems: 'center', display: 'flex', gap: `${8 * uiScale}px` }}>
                <button onClick={() => { void apply(); }} style={sharedStyles.primaryButton(uiScale)}>
                    Apply
                </button>
                <span style={{ color: runtimeError || parsedTab.error ? t.accent.red : t.text.muted, fontSize: `${12 * uiScale}px` }}>
                    {message}
                </span>
            </div>
        </div>
    );
}

function makeNextId(prefix: string, existingIds: string[]): string {
    let index = existingIds.length + 1;
    while (existingIds.includes(`${prefix}_${index}`)) index += 1;
    return `${prefix}_${index}`;
}

function parseActiveTab(activeTab: ActiveTab): ParsedItemsTab {
    if (!activeTab || activeTab.kind !== 'items') {
        return { baseRoot: {}, error: 'Open an items file to use the visual editor.', items: {} };
    }
    try {
        const parsed: unknown = JSON.parse(activeTab.textContent ?? '{}');
        if (!isRecord(parsed)) return { baseRoot: {}, error: 'Items root must be a JSON object.', items: {} };
        const schema = typeof parsed.$schema === 'string' ? parsed.$schema : undefined;
        const items: ItemsMap = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (key === '$schema') continue;
            if (!isRecord(value)) continue;
            items[key] = value as ItemManifestEntry;
        }
        return { baseRoot: parsed, items, schema };
    } catch (caughtError: unknown) {
        return { baseRoot: {}, error: caughtError instanceof Error ? caughtError.message : 'Invalid items JSON', items: {} };
    }
}

function serializeItems(items: ItemsMap, baseRoot: Record<string, unknown>, schema: string | undefined) {
    const nextRoot: Record<string, unknown> = {};
    if (schema) nextRoot.$schema = schema;
    for (const [key, value] of Object.entries(baseRoot)) {
        if (key === '$schema') continue;
        if (isRecord(value)) continue;
        nextRoot[key] = value;
    }
    for (const[key, value] of Object.entries(items)) {
        nextRoot[key] = value;
    }
    return JSON.stringify(nextRoot, undefined, 2);
}