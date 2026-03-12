import { Wand2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { fsWriteTextFile } from '../../../services/fs';
import { useProjectStore } from '../../../store/useProjectStore';
import { useWorkbenchStore } from '../../../store/useWorkbenchStore';
import { editorTheme as t } from '../../../theme/editorTheme';
import { Field, isRecord, sharedStyles } from './EditorSharedUI';

type ActiveTab = ReturnType<typeof useWorkbenchStore.getState>['tabs'][number] | undefined;
type SettingsSection = 'general' | 'paths' | 'scenes' | 'variables';
type VariableType = 'boolean' | 'number' | 'string';
type VariableValue = boolean | number | string;

type ParsedManifestTab = {
    error?: string;
    manifest: Record<string, unknown>;
};

const SECTION_LABELS: Record<SettingsSection, string> = {
    general: 'General',
    paths: 'Paths',
    scenes: 'Scenes',
    variables: 'Variables',
};

export function ManifestEditor({ uiScale }: { uiScale: number }) {
    const activeTab = useWorkbenchStore((state) => state.activeTab());
    const updateTabContent = useWorkbenchStore((state) => state.updateTabContent);

    const [activeSection, setActiveSection] = useState<SettingsSection>('general');
    const [runtimeError, setRuntimeError] = useState<string>();
    const[status, setStatus] = useState('');

    const [newSceneKey, setNewSceneKey] = useState('');
    const[newScenePath, setNewScenePath] = useState('');
    const [newVariableKey, setNewVariableKey] = useState('');
    const[newVariableType, setNewVariableType] = useState<VariableType>('string');
    const [newVariableValue, setNewVariableValue] = useState('');

    const parsedTab = useMemo(() => parseActiveTab(activeTab), [activeTab]);
    const tabId = activeTab?.id;
    const manifest = parsedTab.manifest;

    const sceneEntries = useMemo(() => getSceneEntries(manifest), [manifest]);
    const variableEntries = useMemo(() => getVariableEntries(manifest), [manifest]);

    const updateManifest = (updater: (current: Record<string, unknown>) => Record<string, unknown>) => {
        if (!tabId || !activeTab || activeTab.kind !== 'manifest') return;
        const current = parsedTab.manifest;
        const nextManifest = updater(current);
        if (typeof nextManifest.$schema !== 'string') {
            nextManifest.$schema = 'zerith/manifest';
        }
        const nextText = JSON.stringify(nextManifest, undefined, 2);
        updateTabContent(tabId, nextText);
        setRuntimeError(undefined);
        setStatus('');
    };

    const setManifestStringField = (key: 'characters' | 'items' | 'macros' | 'startScene' | 'title' | 'version', value: string) => {
        updateManifest((current) => {
            const next = { ...current };
            writeOptionalString(next, key, value);
            return next;
        });
    };

    const setSceneEntry = (sceneKey: string, nextKey: string, nextPath: string) => {
        updateManifest((current) => {
            const next = { ...current };
            const scenes = { ...readRecord(current.scenes) };
            delete scenes[sceneKey];
            scenes[nextKey] = nextPath;
            next.scenes = scenes;
            return next;
        });
    };

    const removeScene = (sceneKey: string) => {
        updateManifest((current) => {
            const next = { ...current };
            const scenes = { ...readRecord(current.scenes) };
            delete scenes[sceneKey];
            next.scenes = scenes;
            return next;
        });
    };

    const addScene = () => {
        const key = newSceneKey.trim();
        const path = newScenePath.trim();
        if (!key || !path) return;
        updateManifest((current) => {
            const next = { ...current };
            const scenes = { ...readRecord(current.scenes) };
            scenes[key] = path;
            next.scenes = scenes;
            return next;
        });
        setNewSceneKey('');
        setNewScenePath('');
    };

    const renameVariable = (oldKey: string, nextKey: string) => {
        updateManifest((current) => {
            const next = { ...current };
            const variables = { ...readRecord(current.variables) };
            const value = variables[oldKey];
            delete variables[oldKey];
            variables[nextKey] = toVariableValue(value);
            next.variables = variables;
            return next;
        });
    };

    const updateVariableValue = (key: string, value: VariableValue) => {
        updateManifest((current) => {
            const next = { ...current };
            const variables = { ...readRecord(current.variables) };
            variables[key] = value;
            next.variables = variables;
            return next;
        });
    };

    const removeVariable = (key: string) => {
        updateManifest((current) => {
            const next = { ...current };
            const variables = { ...readRecord(current.variables) };
            delete variables[key];
            next.variables = variables;
            return next;
        });
    };

    const addVariable = () => {
        const key = newVariableKey.trim();
        if (!key) return;
        updateManifest((current) => {
            const next = { ...current };
            const variables = { ...readRecord(current.variables) };
            variables[key] = coerceValueByType(newVariableValue, newVariableType);
            next.variables = variables;
            return next;
        });
        setNewVariableKey('');
        setNewVariableType('string');
        setNewVariableValue('');
    };

    const scanScriptsForVariables = () => {
        const foundKeys = new Set<string>();

        const walk = (nodes: unknown[]) => {
            if (!Array.isArray(nodes)) return;
            for (const node of nodes) {
                if (!node || typeof node !== 'object') continue;
                const rec = node as Record<string, unknown>;

                if (rec.type === 'set' && typeof rec.key === 'string') foundKeys.add(rec.key);
                if (rec.type === 'if' && typeof rec.key === 'string' && rec.source !== 'items') foundKeys.add(rec.key);
                if (rec.type === 'while' && typeof rec.key === 'string' && rec.source !== 'items') foundKeys.add(rec.key);
                if (rec.type === 'for' && typeof rec.iterator === 'string') foundKeys.add(rec.iterator);

                if (Array.isArray(rec.body)) walk(rec.body);
                if (Array.isArray(rec.onTrue)) walk(rec.onTrue);
                if (Array.isArray(rec.onFalse)) walk(rec.onFalse);
                if (Array.isArray(rec.commands)) walk(rec.commands);
                if (Array.isArray(rec.options)) {
                    for (const opt of rec.options) {
                        if (opt && typeof opt === 'object' && Array.isArray((opt as Record<string, unknown>).commands)) {
                            walk((opt as Record<string, unknown>).commands as unknown[]);
                        }
                    }
                }
            }
        };

        const { macros, scenes } = useProjectStore.getState();
        for (const script of Object.values(scenes)) walk(script);
        for (const script of Object.values(macros)) walk(script);

        if (foundKeys.size === 0) {
            setStatus('No variables found in any scripts.');
            return;
        }

        updateManifest((current) => {
            const next = { ...current };
            const variables = { ...readRecord(current.variables) };
            let added = 0;
            for (const key of foundKeys) {
                if (!(key in variables)) {
                    variables[key] = '';
                    added++;
                }
            }
            if (added > 0) {
                next.variables = variables;
                setStatus(`Scanned scripts: auto-registered ${added} new variables.`);
            } else {
                setStatus('Scanned scripts: all variables are already registered.');
            }
            return next;
        });
    };

    const apply = async () => {
        if (!activeTab || activeTab.kind !== 'manifest') return;
        try {
            const nextText = activeTab.textContent ?? '{}';
            await fsWriteTextFile(activeTab.path, nextText);
            setStatus('Saved project settings.');
            setRuntimeError(undefined);
        } catch (caughtError: unknown) {
            setRuntimeError(caughtError instanceof Error ? caughtError.message : 'Failed to apply manifest changes');
        }
    };

    const message = runtimeError ?? parsedTab.error ?? status;

    return (
        <div style={{ display: 'grid', gap: `${10 * uiScale}px`, gridTemplateRows: '1fr auto', height: '100%', padding: `${10 * uiScale}px` }}>
            <div style={{ display: 'grid', gap: `${10 * uiScale}px`, gridTemplateColumns: '220px 1fr', minHeight: 0 }}>
                <div style={sharedStyles.panel(uiScale)}>
                    <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px`, marginBottom: `${8 * uiScale}px` }}>Project Settings</div>
                    <div style={{ display: 'grid', gap: `${6 * uiScale}px` }}>
                        {(Object.keys(SECTION_LABELS) as SettingsSection[]).map((section) => (
                            <button
                                key={section}
                                onClick={() => setActiveSection(section)}
                                style={sharedStyles.rowActive(activeSection === section, uiScale)}
                                type="button"
                            >
                                {SECTION_LABELS[section]}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={sharedStyles.panel(uiScale)}>
                    {activeSection === 'general' && (
                        <div style={{ display: 'grid', gap: `${10 * uiScale}px`, gridTemplateColumns: '1fr 1fr' }}>
                            <Field label="Title">
                                <input onChange={(event) => setManifestStringField('title', event.target.value)} style={sharedStyles.input(uiScale)} value={readString(manifest.title)} />
                            </Field>
                            <Field label="Version">
                                <input onChange={(event) => setManifestStringField('version', event.target.value)} style={sharedStyles.input(uiScale)} value={readString(manifest.version)} />
                            </Field>
                            <Field label="Start Scene">
                                <select onChange={(event) => setManifestStringField('startScene', event.target.value)} style={sharedStyles.input(uiScale)} value={readString(manifest.startScene)}>
                                    <option value="">(none)</option>
                                    {sceneEntries.map(([sceneKey]) => (
                                        <option key={sceneKey} value={sceneKey}>{sceneKey}</option>
                                    ))}
                                </select>
                            </Field>
                        </div>
                    )}

                    {activeSection === 'paths' && (
                        <div style={{ display: 'grid', gap: `${10 * uiScale}px` }}>
                            <Field label="Characters Path">
                                <input onChange={(event) => setManifestStringField('characters', event.target.value)} style={sharedStyles.input(uiScale)} value={readString(manifest.characters)} />
                            </Field>
                            <Field label="Items Path">
                                <input onChange={(event) => setManifestStringField('items', event.target.value)} style={sharedStyles.input(uiScale)} value={readString(manifest.items)} />
                            </Field>
                            <Field label="Macros Path">
                                <input onChange={(event) => setManifestStringField('macros', event.target.value)} style={sharedStyles.input(uiScale)} value={readString(manifest.macros)} />
                            </Field>
                        </div>
                    )}

                    {activeSection === 'scenes' && (
                        <div style={{ display: 'grid', gap: `${10 * uiScale}px` }}>
                            {sceneEntries.length === 0 && <span style={{ color: t.text.muted }}>No scenes configured yet.</span>}
                            {sceneEntries.map(([sceneKey, scenePath]) => (
                                <div key={sceneKey} style={{ display: 'grid', gap: `${8 * uiScale}px`, gridTemplateColumns: '1fr 2fr auto' }}>
                                    <input onChange={(event) => setSceneEntry(sceneKey, event.target.value, scenePath)} style={sharedStyles.input(uiScale)} value={sceneKey} />
                                    <input onChange={(event) => setSceneEntry(sceneKey, sceneKey, event.target.value)} style={sharedStyles.input(uiScale)} value={scenePath} />
                                    <button onClick={() => removeScene(sceneKey)} style={sharedStyles.secondaryButton(uiScale)} type="button">Remove</button>
                                </div>
                            ))}

                            <div style={{ borderTop: `1px solid ${t.border.subtle}`, paddingTop: `${10 * uiScale}px` }}>
                                <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px`, marginBottom: `${8 * uiScale}px` }}>Add Scene</div>
                                <div style={{ display: 'grid', gap: `${8 * uiScale}px`, gridTemplateColumns: '1fr 2fr auto' }}>
                                    <input onChange={(event) => setNewSceneKey(event.target.value)} placeholder="scene_key" style={sharedStyles.input(uiScale)} value={newSceneKey} />
                                    <input onChange={(event) => setNewScenePath(event.target.value)} placeholder="/scripts/scene.json" style={sharedStyles.input(uiScale)} value={newScenePath} />
                                    <button onClick={addScene} style={sharedStyles.secondaryButton(uiScale)} type="button">Add</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'variables' && (
                        <div style={{ display: 'grid', gap: `${10 * uiScale}px` }}>
                            <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: t.text.muted }}>Global Game Variables</span>
                                <button onClick={scanScriptsForVariables} style={{ ...sharedStyles.secondaryButton(uiScale), alignItems: 'center', display: 'flex', gap: '6px' }} title="Scan scripts and automatically register any missing variables">
                                    <Wand2 size={14 * uiScale} /> Auto-Scan Scripts
                                </button>
                            </div>

                            {variableEntries.length === 0 && <span style={{ color: t.text.muted }}>No global variables configured yet.</span>}
                            {variableEntries.map(([key, value]) => {
                                const type = inferVariableType(value);
                                return (
                                    <div key={key} style={{ display: 'grid', gap: `${8 * uiScale}px`, gridTemplateColumns: '1fr 120px 1fr auto' }}>
                                        <input onChange={(event) => renameVariable(key, event.target.value)} style={sharedStyles.input(uiScale)} value={key} />
                                        <select onChange={(event) => updateVariableValue(key, coerceValueByType(String(value), event.target.value as VariableType))} style={sharedStyles.input(uiScale)} value={type}>
                                            <option value="string">string</option>
                                            <option value="number">number</option>
                                            <option value="boolean">boolean</option>
                                        </select>
                                        {type === 'boolean' ? (
                                            <select onChange={(event) => updateVariableValue(key, event.target.value === 'true')} style={sharedStyles.input(uiScale)} value={value ? 'true' : 'false'}>
                                                <option value="true">true</option>
                                                <option value="false">false</option>
                                            </select>
                                        ) : (
                                            <input
                                                onChange={(event) => updateVariableValue(key, coerceValueByType(event.target.value, type))}
                                                style={sharedStyles.input(uiScale)}
                                                type={type === 'number' ? 'number' : 'text'}
                                                value={String(value)}
                                            />
                                        )}
                                        <button onClick={() => removeVariable(key)} style={sharedStyles.secondaryButton(uiScale)} type="button">Delete</button>
                                    </div>
                                );
                            })}

                            <div style={{ borderTop: `1px solid ${t.border.subtle}`, paddingTop: `${10 * uiScale}px` }}>
                                <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px`, marginBottom: `${8 * uiScale}px` }}>Add Variable</div>
                                <div style={{ display: 'grid', gap: `${8 * uiScale}px`, gridTemplateColumns: '1fr 120px 1fr auto' }}>
                                    <input onChange={(event) => setNewVariableKey(event.target.value)} placeholder="variable_key" style={sharedStyles.input(uiScale)} value={newVariableKey} />
                                    <select onChange={(event) => setNewVariableType(event.target.value as VariableType)} style={sharedStyles.input(uiScale)} value={newVariableType}>
                                        <option value="string">string</option>
                                        <option value="number">number</option>
                                        <option value="boolean">boolean</option>
                                    </select>
                                    {newVariableType === 'boolean' ? (
                                        <select onChange={(event) => setNewVariableValue(event.target.value)} style={sharedStyles.input(uiScale)} value={newVariableValue || 'false'}>
                                            <option value="true">true</option>
                                            <option value="false">false</option>
                                        </select>
                                    ) : (
                                        <input onChange={(event) => setNewVariableValue(event.target.value)} placeholder={newVariableType === 'number' ? '0' : 'default value'} style={sharedStyles.input(uiScale)} type={newVariableType === 'number' ? 'number' : 'text'} value={newVariableValue} />
                                    )}
                                    <button onClick={addVariable} style={sharedStyles.secondaryButton(uiScale)} type="button">Add</button>
                                </div>
                            </div>
                        </div>
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

function coerceValueByType(value: string, type: VariableType): VariableValue {
    if (type === 'boolean') return value === 'true';
    if (type === 'number') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return value;
}

function getSceneEntries(manifest: Record<string, unknown>): Array<[string, string]> {
    const scenes = readRecord(manifest.scenes);
    const entries: Array<[string, string]> = [];
    for (const [key, value] of Object.entries(scenes)) {
        if (typeof value === 'string') entries.push([key, value]);
    }
    return entries;
}

function getVariableEntries(manifest: Record<string, unknown>): Array<[string, VariableValue]> {
    const variables = readRecord(manifest.variables);
    const entries: Array<[string, VariableValue]> = [];
    for (const [key, value] of Object.entries(variables)) {
        entries.push([key, toVariableValue(value)]);
    }
    return entries;
}

function inferVariableType(value: VariableValue): VariableType {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    return 'string';
}

function parseActiveTab(activeTab: ActiveTab): ParsedManifestTab {
    if (!activeTab || activeTab.kind !== 'manifest') {
        return { error: 'Open `game.json` to use the visual manifest editor.', manifest: {} };
    }
    try {
        const parsed: unknown = JSON.parse(activeTab.textContent ?? '{}');
        if (!isRecord(parsed)) return { error: 'Manifest root must be a JSON object.', manifest: {} };
        return { manifest: parsed };
    } catch (caughtError: unknown) {
        return { error: caughtError instanceof Error ? caughtError.message : 'Invalid manifest JSON', manifest: {} };
    }
}

function readRecord(value: unknown): Record<string, unknown> {
    return isRecord(value) ? value : {};
}

function readString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function toVariableValue(value: unknown): VariableValue {
    if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return value;
    return '';
}

function writeOptionalString(target: Record<string, unknown>, key: string, value: string) {
    const normalized = value.trim();
    if (normalized.length === 0) { delete target[key]; return; }
    target[key] = normalized;
}