import { EngineConfigSchema, type EngineConfigFile } from 'core';

import { useMemo, useState } from 'react';

import { fsWriteTextFile } from '../../../services/fs';
import { useProjectStore } from '../../../store/storeBootstrap';
import { useWorkbenchStore } from '../../../store/useWorkbenchStore';
import { editorTheme as t } from '../../../theme/editorTheme';
import { Field, isRecord, sharedStyles } from './EditorSharedUI';

type ActiveTab = ReturnType<typeof useWorkbenchStore.getState>['tabs'][number] | undefined;

type ParsedConfigTab = {
    config: EngineConfigFile;
    error?: string;
};

const DISPLAY_SCALE_MODES = ['fill', 'fit', 'fixed', 'stretch'] as const;

type DisplayScaleMode = (typeof DISPLAY_SCALE_MODES)[number];

export function EngineConfigEditor({ uiScale }: { uiScale: number }) {
    const activeTab = useWorkbenchStore((state) => state.activeTab());
    const updateTabContent = useWorkbenchStore((state) => state.updateTabContent);
    const clearFileDirty = useProjectStore((state) => state.clearFileDirty);

    const [runtimeError, setRuntimeError] = useState<string>();
    const [status, setStatus] = useState('');

    const parsedTab = useMemo(() => parseActiveTab(activeTab), [activeTab]);
    const tabId = activeTab?.id;

    const display = readRecord(parsedTab.config.display);
    const theme = readRecord(parsedTab.config.theme);

    const updateConfig = (updater: (current: EngineConfigFile) => EngineConfigFile) => {
        if (!tabId || !activeTab || activeTab.kind !== 'engineConfig') return;
        const nextConfig = updater(parsedTab.config);
        const nextText = JSON.stringify(nextConfig, undefined, 2);
        updateTabContent(tabId, nextText);
        setRuntimeError(undefined);
        setStatus('');
    };

    const setDisplayNumber = (key: 'height' | 'width', value: string) => {
        updateConfig((current) => {
            const nextDisplay = { ...readRecord(current.display) };
            writeOptionalNumber(nextDisplay, key, value);
            return { ...current, display: nextDisplay };
        });
    };

    const setDisplayScaleMode = (value: string) => {
        updateConfig((current) => {
            const nextDisplay = { ...readRecord(current.display) };
            if (!value) {
                delete nextDisplay.scaleMode;
            } else {
                nextDisplay.scaleMode = value as DisplayScaleMode;
            }
            return { ...current, display: nextDisplay };
        });
    };

    const setThemeString = (key: 'fontFamily', value: string) => {
        updateConfig((current) => {
            const nextTheme = { ...readRecord(current.theme) };
            writeOptionalString(nextTheme, key, value);
            return { ...current, theme: nextTheme };
        });
    };

    const setThemeNumber = (key: 'accentColor' | 'borderColor' | 'borderWidth' | 'boxAlpha' | 'boxColor' | 'fontSize' | 'hoverColor', value: string) => {
        updateConfig((current) => {
            const nextTheme = { ...readRecord(current.theme) };
            writeOptionalNumber(nextTheme, key, value);
            return { ...current, theme: nextTheme };
        });
    };

    const apply = async () => {
        if (!activeTab || activeTab.kind !== 'engineConfig') return;
        try {
            const nextText = activeTab.textContent ?? '{}';
            await fsWriteTextFile(activeTab.path, nextText);
            updateTabContent(activeTab.id, nextText, { markDirty: false });
            clearFileDirty(activeTab.path);
            setStatus('Saved engine config.');
            setRuntimeError(undefined);
        } catch (caughtError: unknown) {
            setRuntimeError(caughtError instanceof Error ? caughtError.message : 'Failed to save engine config');
        }
    };

    const message = runtimeError ?? parsedTab.error ?? status;

    return (
        <div style={{ display: 'grid', gap: `${10 * uiScale}px`, gridTemplateRows: '1fr auto', height: '100%', padding: `${10 * uiScale}px` }}>
            <div style={{ display: 'grid', gap: `${10 * uiScale}px`, gridTemplateColumns: '1fr 1fr', minHeight: 0 }}>
                <div style={sharedStyles.panel(uiScale)}>
                    <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px`, marginBottom: `${8 * uiScale}px` }}>Display</div>
                    <div style={{ display: 'grid', gap: `${10 * uiScale}px` }}>
                        <Field label="Width">
                            <input onChange={(event) => setDisplayNumber('width', event.target.value)} style={sharedStyles.input(uiScale)} type="number" value={readNumber(display.width)} />
                        </Field>
                        <Field label="Height">
                            <input onChange={(event) => setDisplayNumber('height', event.target.value)} style={sharedStyles.input(uiScale)} type="number" value={readNumber(display.height)} />
                        </Field>
                        <Field label="Scale Mode">
                            <select onChange={(event) => setDisplayScaleMode(event.target.value)} style={sharedStyles.input(uiScale)} value={readScaleMode(display.scaleMode)}>
                                <option value="">(default)</option>
                                {DISPLAY_SCALE_MODES.map((mode) => (
                                    <option key={mode} value={mode}>{mode}</option>
                                ))}
                            </select>
                        </Field>
                    </div>
                </div>

                <div style={sharedStyles.panel(uiScale)}>
                    <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px`, marginBottom: `${8 * uiScale}px` }}>Theme Overrides</div>
                    <div style={{ display: 'grid', gap: `${10 * uiScale}px` }}>
                        <Field label="Font Family">
                            <input onChange={(event) => setThemeString('fontFamily', event.target.value)} style={sharedStyles.input(uiScale)} value={readString(theme.fontFamily)} />
                        </Field>
                        <Field label="Font Size">
                            <input onChange={(event) => setThemeNumber('fontSize', event.target.value)} style={sharedStyles.input(uiScale)} type="number" value={readNumber(theme.fontSize)} />
                        </Field>
                        <Field label="Box Color">
                            <input onChange={(event) => setThemeNumber('boxColor', event.target.value)} style={sharedStyles.input(uiScale)} type="number" value={readNumber(theme.boxColor)} />
                        </Field>
                        <Field label="Box Alpha">
                            <input max={1} min={0} onChange={(event) => setThemeNumber('boxAlpha', event.target.value)} step="0.05" style={sharedStyles.input(uiScale)} type="number" value={readNumber(theme.boxAlpha)} />
                        </Field>
                        <Field label="Accent Color">
                            <input onChange={(event) => setThemeNumber('accentColor', event.target.value)} style={sharedStyles.input(uiScale)} type="number" value={readNumber(theme.accentColor)} />
                        </Field>
                        <Field label="Border Color">
                            <input onChange={(event) => setThemeNumber('borderColor', event.target.value)} style={sharedStyles.input(uiScale)} type="number" value={readNumber(theme.borderColor)} />
                        </Field>
                        <Field label="Border Width">
                            <input onChange={(event) => setThemeNumber('borderWidth', event.target.value)} style={sharedStyles.input(uiScale)} type="number" value={readNumber(theme.borderWidth)} />
                        </Field>
                        <Field label="Hover Color">
                            <input onChange={(event) => setThemeNumber('hoverColor', event.target.value)} style={sharedStyles.input(uiScale)} type="number" value={readNumber(theme.hoverColor)} />
                        </Field>
                    </div>
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

function parseActiveTab(activeTab: ActiveTab): ParsedConfigTab {
    if (!activeTab || activeTab.kind !== 'engineConfig') {
        return { config: {}, error: 'Open `engine.config.json` to use the engine config editor.' };
    }

    try {
        const parsed: unknown = JSON.parse(activeTab.textContent ?? '{}');
        if (!isRecord(parsed)) {
            return { config: {}, error: 'Engine config root must be a JSON object.' };
        }

        const validation = EngineConfigSchema.safeParse(parsed);
        if (!validation.success) {
            return {
                config: parsed,
                error: validation.error.issues[0]?.message ?? 'Invalid engine config.',
            };
        }

        return { config: validation.data };
    } catch (caughtError: unknown) {
        return {
            config: {},
            error: caughtError instanceof Error ? caughtError.message : 'Invalid engine config JSON',
        };
    }
}

function readNumber(value: unknown): string {
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function readRecord(value: unknown): Record<string, unknown> {
    return isRecord(value) ? value : {};
}

function readScaleMode(value: unknown): string {
    return typeof value === 'string' && DISPLAY_SCALE_MODES.includes(value as DisplayScaleMode) ? value : '';
}

function readString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function writeOptionalNumber(target: Record<string, unknown>, key: string, value: string) {
    const normalized = value.trim();
    if (normalized.length === 0) {
        delete target[key];
        return;
    }

    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) {
        target[key] = numeric;
    }
}

function writeOptionalString(target: Record<string, unknown>, key: string, value: string) {
    if (value.trim().length === 0) {
        delete target[key];
        return;
    }

    target[key] = value;
}

