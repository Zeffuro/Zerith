import type { CharacterDefinition } from 'core';

import { Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ColorPickerField } from '../../inspector/fields/ColorPickerField';
import { fsWriteTextFile } from '../../../services/fs';
import { useWorkbenchStore } from '../../../store/useWorkbenchStore';
import { editorTheme as t } from '../../../theme/editorTheme';
import { Field, isRecord, sharedStyles } from './EditorSharedUI';

type ActiveTab = ReturnType<typeof useWorkbenchStore.getState>['tabs'][number] | undefined;
type CharactersMap = Record<string, CharacterDefinition>;

type ParsedCharactersTab = {
    baseRoot: Record<string, unknown>;
    characters: CharactersMap;
    error?: string;
    schema?: string;
};

export function CharactersEditor({ uiScale }: { uiScale: number }) {
    const activeTab = useWorkbenchStore((state) => state.activeTab());
    const updateTabContent = useWorkbenchStore((state) => state.updateTabContent);

    const[selectedByTab, setSelectedByTab] = useState<Record<string, string>>({});
    const[runtimeError, setRuntimeError] = useState<string>();
    const [status, setStatus] = useState('');

    const parsedTab = useMemo(() => parseActiveTab(activeTab), [activeTab]);
    const tabId = activeTab?.id;
    const characters = parsedTab.characters;
    const characterIds = useMemo(() => Object.keys(characters), [characters]);
    const selectedCharacterId =
        tabId && selectedByTab[tabId] && characters[selectedByTab[tabId]]
            ? selectedByTab[tabId]
            : (characterIds[0] ?? '');
    const selectedCharacter = selectedCharacterId ? characters[selectedCharacterId] : undefined;

    const setCharacters = (updater: (current: CharactersMap) => CharactersMap) => {
        if (!tabId || !activeTab || activeTab.kind !== 'characters') return;
        const nextCharacters = updater(parsedTab.characters);
        const nextText = serializeCharacters(nextCharacters, parsedTab.baseRoot, parsedTab.schema);
        updateTabContent(tabId, nextText);
        setRuntimeError(undefined);
        setStatus('');
    };

    const setSelectedCharacterId = (nextId: string) => {
        if (!tabId) return;
        setSelectedByTab((previous) => ({ ...previous, [tabId]: nextId }));
    };

    const addCharacter = () => {
        const nextId = makeNextId('character', characterIds);
        setCharacters((current) => ({
            ...current,
            [nextId]: {
                displayName: nextId,
                name: nextId,
                nameColor: '#ffffff',
                portraitUrl: '',
                talkAnimation: '',
            },
        }));
        setSelectedCharacterId(nextId);
    };

    const updateSelected = (patch: Partial<CharacterDefinition>) => {
        if (!selectedCharacterId) return;
        setCharacters((current) => ({
            ...current,
            [selectedCharacterId]: {
                ...current[selectedCharacterId],
                ...patch,
            },
        }));
    };

    const apply = async () => {
        if (!activeTab || activeTab.kind !== 'characters') return;
        try {
            const nextText = activeTab.textContent ?? '{}';
            await fsWriteTextFile(activeTab.path, nextText);
            setStatus('Saved characters.');
            setRuntimeError(undefined);
        } catch (caughtError: unknown) {
            setRuntimeError(caughtError instanceof Error ? caughtError.message : 'Failed to save characters file');
        }
    };

    const deleteSelectedCharacter = () => {
        if (!selectedCharacterId) return;
        const remainingIds = characterIds.filter((id) => id !== selectedCharacterId);
        setCharacters((current) => {
            const next = { ...current };
            delete next[selectedCharacterId];
            return next;
        });
        if (tabId) {
            setSelectedByTab((previous) => ({
                ...previous,
                [tabId]: remainingIds[0] ?? '',
            }));
        }
    };

    const message = runtimeError ?? parsedTab.error ?? status;

    return (
        <div style={{ display: 'grid', gap: `${10 * uiScale}px`, gridTemplateRows: '1fr auto', height: '100%', padding: `${10 * uiScale}px` }}>
            <div style={{ display: 'grid', gap: `${10 * uiScale}px`, gridTemplateColumns: '280px 1fr', minHeight: 0 }}>
                <div style={sharedStyles.panel(uiScale)}>
                    <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
                        <strong>Characters</strong>
                        <div style={{ display: 'flex', gap: `${6 * uiScale}px` }}>
                            <button onClick={addCharacter} style={sharedStyles.secondaryButton(uiScale)}>
                                + Add Character
                            </button>
                            <button
                                disabled={!selectedCharacterId}
                                onClick={deleteSelectedCharacter}
                                style={sharedStyles.iconButton(Boolean(selectedCharacterId), uiScale)}
                                title="Delete Character"
                                type="button"
                            >
                                <Trash2 size={12 * uiScale} />
                            </button>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gap: `${6 * uiScale}px`, marginTop: `${8 * uiScale}px`, overflow: 'auto' }}>
                        {characterIds.map((characterId) => (
                            <button key={characterId} onClick={() => setSelectedCharacterId(characterId)} style={sharedStyles.rowActive(characterId === selectedCharacterId, uiScale)}>
                                {characterId}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={sharedStyles.panel(uiScale)}>
                    {selectedCharacter ? (
                        <div style={{ display: 'grid', gap: `${10 * uiScale}px`, gridTemplateColumns: '1fr 1fr' }}>
                            <Field label="Display Name">
                                <input onChange={(event) => updateSelected({ displayName: event.target.value })} style={sharedStyles.input(uiScale)} value={selectedCharacter.displayName ?? ''} />
                            </Field>
                            <Field label="Talk Animation">
                                <input onChange={(event) => updateSelected({ talkAnimation: event.target.value || undefined })} style={sharedStyles.input(uiScale)} value={selectedCharacter.talkAnimation ?? ''} />
                            </Field>
                            <Field label="Name Color">
                                <ColorPickerField
                                    inputMode="text"
                                    inputStyle={sharedStyles.input(uiScale)}
                                    onChange={(hexValue) => updateSelected({ nameColor: hexValue })}
                                    uiScale={uiScale}
                                    value={selectedCharacter.nameColor ?? '#FFFFFF'}
                                />
                            </Field>
                            <Field label="Portrait URL">
                                <input onChange={(event) => updateSelected({ portraitUrl: event.target.value || undefined })} style={sharedStyles.input(uiScale)} value={selectedCharacter.portraitUrl ?? ''} />
                            </Field>
                        </div>
                    ) : (
                        <span style={{ color: t.text.muted }}>Select a character to edit.</span>
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

function parseActiveTab(activeTab: ActiveTab): ParsedCharactersTab {
    if (!activeTab || activeTab.kind !== 'characters') {
        return { baseRoot: {}, characters: {}, error: 'Open a characters file to use the visual editor.' };
    }
    try {
        const parsed: unknown = JSON.parse(activeTab.textContent ?? '{}');
        if (!isRecord(parsed)) return { baseRoot: {}, characters: {}, error: 'Characters root must be a JSON object.' };
        const schemaValue = parsed['$schema'];
        const schema = typeof schemaValue === 'string' ? schemaValue : undefined;
        const characters: CharactersMap = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (key === '$schema') continue;
            const normalized = normalizeCharacterDefinition(key, value);
            if (!normalized) continue;
            characters[key] = normalized;
        }
        return { baseRoot: parsed, characters, schema };
    } catch (caughtError: unknown) {
        return { baseRoot: {}, characters: {}, error: caughtError instanceof Error ? caughtError.message : 'Invalid characters JSON' };
    }
}

function serializeCharacters(characters: CharactersMap, baseRoot: Record<string, unknown>, schema: string | undefined) {
    const nextRoot: Record<string, unknown> = {};
    const nextSchema = schema ?? 'zerith/characters';
    for (const[key, value] of Object.entries(baseRoot)) {
        if (key === '$schema') continue;
        if (isRecord(value)) continue;
        nextRoot[key] = value;
    }
    nextRoot.$schema = nextSchema;
    for (const [key, value] of Object.entries(characters)) {
        nextRoot[key] = value;
    }
    return JSON.stringify(nextRoot, undefined, 2);
}

function normalizeCharacterDefinition(id: string, value: unknown): CharacterDefinition | undefined {
    if (!isRecord(value)) return;
    if (typeof value.displayName !== 'string') return;

    const source = value as Record<string, unknown>;
    return {
        ...source,
        displayName: value.displayName,
        name: typeof value.name === 'string' ? value.name : id,
    } as unknown as CharacterDefinition;
}