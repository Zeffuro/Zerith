import { useMemo, useState } from 'react';

import { fsWriteTextFile } from '../../../services/fs';
import { useProjectStore } from '../../../store/useProjectStore';
import { useReferenceStore } from '../../../store/useReferenceStore';
import { useWorkbenchStore } from '../../../store/useWorkbenchStore';
import { editorTheme as t } from '../../../theme/editorTheme';
import { DOCK_PANELS } from '../dock/dockPanelIds';
import { Field, isRecord, sharedStyles } from './EditorSharedUI';

type ActiveTab = ReturnType<typeof useWorkbenchStore.getState>['tabs'][number] | undefined;

type ParsedManifestTab = {
    error?: string;
    manifest: Record<string, unknown>;
};

type SettingsSection = 'general' | 'paths' | 'scenes' | 'variables';

const SECTION_LABELS: Record<SettingsSection, string> = {
    general: 'General',
    paths: 'Paths',
    scenes: 'Scenes',
    variables: 'Discovered Variables',
};

export function ManifestEditor({ uiScale }: { uiScale: number }) {
    const activeTab = useWorkbenchStore((state) => state.activeTab());
    const updateTabContent = useWorkbenchStore((state) => state.updateTabContent);
    const clearFileDirty = useProjectStore((state) => state.clearFileDirty);

    const [activeSection, setActiveSection] = useState<SettingsSection>('general');
    const [runtimeError, setRuntimeError] = useState<string>();
    const[status, setStatus] = useState('');

    const [newSceneKey, setNewSceneKey] = useState('');
    const[newScenePath, setNewScenePath] = useState('');
    const discoveredVariables = useReferenceStore((state) => state.result.variables);

    const parsedTab = useMemo(() => parseActiveTab(activeTab), [activeTab]);
    const tabId = activeTab?.id;
    const manifest = parsedTab.manifest;

    const sceneEntries = useMemo(() => getSceneEntries(manifest), [manifest]);
    const discoveredVariableEntries = useMemo(
        () => Object.entries(discoveredVariables).toSorted(([left], [right]) => left.localeCompare(right)),
        [discoveredVariables],
    );

    const updateManifest = (updater: (current: Record<string, unknown>) => Record<string, unknown>) => {
        if (!tabId || !activeTab || activeTab.kind !== 'manifest') return;
        const current = parsedTab.manifest;
        const nextManifestSource = updater(current);
        const nextManifest = typeof nextManifestSource.$schema === 'string'
            ? nextManifestSource
            : { ...nextManifestSource, $schema: 'zerith/manifest' };
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
            const scenes = readRecord(current.scenes);
            const { [sceneKey]: _removed, ...rest } = scenes;
            void _removed;
            next.scenes = { ...rest, [nextKey]: nextPath };
            return next;
        });
    };

    const removeScene = (sceneKey: string) => {
        updateManifest((current) => {
            const next = { ...current };
            const scenes = readRecord(current.scenes);
            const { [sceneKey]: _removed, ...rest } = scenes;
            void _removed;
            next.scenes = rest;
            return next;
        });
    };

    const addScene = () => {
        const key = newSceneKey.trim();
        const path = newScenePath.trim();
        if (!key || !path) return;
        updateManifest((current) => ({
            ...current,
            scenes: { ...readRecord(current.scenes), [key]: path },
        }));
        setNewSceneKey('');
        setNewScenePath('');
    };

    const apply = async () => {
        if (!activeTab || activeTab.kind !== 'manifest') return;
        try {
            const nextText = activeTab.textContent ?? '{}';
            await fsWriteTextFile(activeTab.path, nextText);
            updateTabContent(activeTab.id, nextText, { markDirty: false });
            clearFileDirty(activeTab.path);
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
                            <div style={{ color: t.text.muted }}>
                                Variables are now discovered automatically from scripts and macros.
                            </div>

                            <button
                                onClick={openReferenceTracker}
                                style={{ ...sharedStyles.secondaryButton(uiScale), justifySelf: 'start' }}
                                type="button"
                            >
                                Open Reference Tracker
                            </button>

                            {discoveredVariableEntries.length === 0 && (
                                <span style={{ color: t.text.muted }}>No discovered variables yet.</span>
                            )}

                            {discoveredVariableEntries.map(([key, stats]) => (
                                <div
                                    key={key}
                                    style={{
                                        border: `1px solid ${t.border.subtle}`,
                                        borderRadius: t.radius.sm,
                                        display: 'grid',
                                        gap: `${4 * uiScale}px`,
                                        padding: `${8 * uiScale}px`,
                                    }}
                                >
                                    <strong style={{ color: t.text.primary }}>{key}</strong>
                                    <span style={{ color: t.text.faint, fontSize: `${12 * uiScale}px` }}>
                                        type: {stats.inferredType} | reads: {stats.reads.length} | writes: {stats.writes.length}
                                    </span>
                                </div>
                            ))}
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

function getSceneEntries(manifest: Record<string, unknown>): Array<[string, string]> {
    const scenes = readRecord(manifest.scenes);
    const entries: Array<[string, string]> = [];
    for (const [key, value] of Object.entries(scenes)) {
        if (typeof value === 'string') entries.push([key, value]);
    }
    return entries;
}


function openReferenceTracker() {
    globalThis.dispatchEvent(new CustomEvent('zerith:dock-select', { detail: DOCK_PANELS.referenceTracker }));
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

function writeOptionalString(target: Record<string, unknown>, key: string, value: string) {
    const normalized = value.trim();
    if (normalized.length === 0) { delete target[key]; return; }
    target[key] = normalized;
}

