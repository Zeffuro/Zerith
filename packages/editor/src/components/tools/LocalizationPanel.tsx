import type { CSSProperties } from 'react';

import { AlertTriangle, CheckCircle2, ExternalLink, Languages, Plus, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { LocalizationPanelRowLocation } from './localizationPanelModel';

import { fsJoin, fsMkdir, fsReadTextFile, fsWriteTextFile } from '../../services/fs';
import { openProjectEntry } from '../../services/openProjectEntry';
import { useProjectStore } from '../../store/storeBootstrap';
import { useEditorStore } from '../../store/useEditorStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { DOCK_PANELS } from '../layout/dock/dockPanelIds';
import {
    buildLocalizationPanelRows,
    createLocaleBundleFromRows,
    getLocaleManifestPath,
    toLocalizationEntryKey,
    updateLocaleBundleEntries,
} from './localizationPanelModel';

export function LocalizationPanel({ initialQuery }: { initialQuery?: string } = {}) {
    const loadManifest = useProjectStore((state) => state.loadManifest);
    const localePaths = useProjectStore((state) => state.localePaths);
    const locales = useProjectStore((state) => state.locales);
    const manifest = useProjectStore((state) => state.manifest);
    const projectPath = useProjectStore((state) => state.projectPath);
    const sceneNamespaces = useProjectStore((state) => state.sceneNamespaces);
    const scenePaths = useProjectStore((state) => state.scenePaths);
    const scenes = useProjectStore((state) => state.scenes);
    const previewLocale = useEditorStore((state) => state.previewLocale);
    const setPreviewLocale = useEditorStore((state) => state.setPreviewLocale);
    const uiScale = useEditorStore((state) => state.uiScale);

    const localeIds = useMemo(
        () => Object.keys(locales).toSorted((left, right) => left.localeCompare(right)),
        [locales],
    );
    const [draftValues, setDraftValues] = useState<Record<string, string>>({});
    const [newLocale, setNewLocale] = useState('');
    const [query, setQuery] = useState(initialQuery ?? '');
    const [selectedLocale, setSelectedLocale] = useState<string>('');
    const [status, setStatus] = useState<{ kind: 'error' | 'ok'; text: string } | undefined>();

    useEffect(() => {
        if (previewLocale && localeIds.includes(previewLocale)) {
            setSelectedLocale(previewLocale);
            return;
        }
        const defaultLocale = manifest?.localization?.defaultLocale;
        if (defaultLocale && localeIds.includes(defaultLocale)) {
            setSelectedLocale(defaultLocale);
            return;
        }
        setSelectedLocale(localeIds[0] ?? '');
    }, [localeIds, manifest?.localization?.defaultLocale, previewLocale]);

    useEffect(() => {
        setDraftValues({});
        setStatus(undefined);
    }, [projectPath, selectedLocale]);

    useEffect(() => {
        if (initialQuery === undefined) return;
        setQuery(initialQuery);
    }, [initialQuery]);

    const selectedBundle = selectedLocale ? locales[selectedLocale] : undefined;
    const rows = useMemo(
        () => buildLocalizationPanelRows({ sceneNamespaces, scenePaths, scenes }, selectedBundle),
        [sceneNamespaces, scenePaths, scenes, selectedBundle],
    );
    const filteredRows = useMemo(
        () => filterRows(rows, query),
        [query, rows],
    );
    const dirtyEntryCount = Object.keys(draftValues).length;
    const missingCount = rows.filter((row) => row.status === 'missing').length;
    const translatedCount = rows.filter((row) => row.status === 'translated').length;

    const handleDraftChange = (key: string, nextValue: string, currentValue: string) => {
        setDraftValues((current) => {
            const next = { ...current };
            if (nextValue === currentValue) {
                delete next[key];
            } else {
                next[key] = nextValue;
            }
            return next;
        });
    };

    const handleSave = async () => {
        if (!projectPath || !selectedLocale || !selectedBundle || dirtyEntryCount === 0) return;

        try {
            const nextBundle = updateLocaleBundleEntries(selectedBundle, draftValues);
            const manifestLocalePath = localePaths[selectedLocale] ? undefined : getLocaleManifestPath(selectedLocale);
            const localePath = localePaths[selectedLocale]
                ?? await resolveProjectPath(projectPath, manifestLocalePath!);

            if (manifestLocalePath) {
                await ensureLocaleManifestEntry(projectPath, selectedLocale, manifestLocalePath);
            }

            await fsWriteTextFile(localePath, JSON.stringify(nextBundle, undefined, 4));
            setDraftValues({});
            await loadManifest();
            setStatus({ kind: 'ok', text: `Saved ${selectedLocale}.` });
        } catch (error) {
            setStatus({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
        }
    };

    const handleAddLocale = async () => {
        if (!projectPath) return;
        const locale = newLocale.trim();
        if (!locale) return;

        if (locales[locale]) {
            setSelectedLocale(locale);
            setPreviewLocale(locale);
            setNewLocale('');
            return;
        }

        try {
            const sourceRows = buildLocalizationPanelRows({ sceneNamespaces, scenePaths, scenes });
            const bundle = createLocaleBundleFromRows(locale, sourceRows);
            const manifestLocalePath = getLocaleManifestPath(locale);
            const localeDirectory = await fsJoin(projectPath, 'locales');
            const localePath = await resolveProjectPath(projectPath, manifestLocalePath);

            await fsMkdir(localeDirectory, true);
            await fsWriteTextFile(localePath, JSON.stringify(bundle, undefined, 4));
            await ensureLocaleManifestEntry(projectPath, locale, manifestLocalePath);
            await loadManifest();

            setDraftValues({});
            setNewLocale('');
            setPreviewLocale(locale);
            setSelectedLocale(locale);
            setStatus({ kind: 'ok', text: `Created ${locale}.` });
        } catch (error) {
            setStatus({ kind: 'error', text: error instanceof Error ? error.message : String(error) });
        }
    };

    if (!projectPath) {
        return <EmptyPanelMessage message="Open a project to edit locale strings." uiScale={uiScale} />;
    }

    return (
        <div className="zerith-scrollbar" style={panelStyle(uiScale)}>
            <div style={headerStyle(uiScale)}>
                <strong>Localization</strong>
                <button
                    className="toolbar-btn"
                    disabled={!selectedLocale}
                    onClick={() => selectedLocale && setPreviewLocale(selectedLocale)}
                    style={actionButtonStyle(uiScale, !selectedLocale)}
                    title="Use selected locale in preview"
                    type="button"
                >
                    <Languages size={14 * uiScale} />
                    <span>{previewLocale === selectedLocale ? 'Previewing' : 'Use in Preview'}</span>
                </button>
            </div>

            <div style={toolbarGridStyle(uiScale)}>
                <select
                    disabled={localeIds.length === 0}
                    onChange={(event) => setSelectedLocale(event.currentTarget.value)}
                    style={inputStyle(uiScale)}
                    value={selectedLocale}
                >
                    {localeIds.length === 0 ? <option value="">No locales</option> : undefined}
                    {localeIds.map((locale) => (
                        <option key={locale} value={locale}>{locale}</option>
                    ))}
                </select>
                <input
                    onChange={(event) => setNewLocale(event.currentTarget.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') void handleAddLocale();
                    }}
                    placeholder="New locale"
                    style={inputStyle(uiScale)}
                    value={newLocale}
                />
                <button className="toolbar-btn" onClick={() => void handleAddLocale()} style={iconButtonStyle(uiScale)} title="Add locale" type="button">
                    <Plus size={14 * uiScale} />
                </button>
            </div>

            <div style={summaryGridStyle(uiScale)}>
                <SummaryChip label="Lines" uiScale={uiScale} value={rows.length} />
                <SummaryChip label="Missing" tone={missingCount > 0 ? 'bad' : 'good'} uiScale={uiScale} value={missingCount} />
                <SummaryChip label="Translated" uiScale={uiScale} value={translatedCount} />
                <SummaryChip label="Unsaved" tone={dirtyEntryCount > 0 ? 'warn' : undefined} uiScale={uiScale} value={dirtyEntryCount} />
            </div>

            {status ? (
                <div style={statusStyle(status.kind, uiScale)}>
                    {status.kind === 'ok' ? <CheckCircle2 size={14 * uiScale} /> : <AlertTriangle size={14 * uiScale} />}
                    <span>{status.text}</span>
                </div>
            ) : undefined}

            <div style={saveRowStyle(uiScale)}>
                <input
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Filter line IDs or text..."
                    style={inputStyle(uiScale)}
                    value={query}
                />
                <button
                    className="toolbar-btn primary"
                    disabled={dirtyEntryCount === 0 || !selectedLocale}
                    onClick={() => void handleSave()}
                    style={actionButtonStyle(uiScale, dirtyEntryCount === 0 || !selectedLocale)}
                    title="Save locale"
                    type="button"
                >
                    <Save size={14 * uiScale} />
                    <span>Save Locale</span>
                </button>
            </div>

            {localeIds.length === 0 ? (
                <div style={{ color: t.text.faint, fontStyle: 'italic' }}>No locale bundle is registered in this project.</div>
            ) : undefined}

            {filteredRows.map((row) => {
                const key = toLocalizationEntryKey(row.namespace, row.lineId);
                const draftValue = draftValues[key] ?? row.value;
                return (
                    <div key={key} style={rowStyle(uiScale)}>
                        <div style={rowHeaderStyle(uiScale)}>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ color: t.text.primary, fontWeight: 700, overflowWrap: 'anywhere' }}>{row.lineId}</div>
                                <div style={{ color: t.text.faint, fontSize: `${11 * uiScale}px`, overflowWrap: 'anywhere' }}>
                                    {row.namespace} - {row.kind === 'choice-option' ? 'choice label' : 'dialogue'}
                                </div>
                            </div>
                            <span style={statusBadgeStyle(row.status, uiScale)}>{row.status}</span>
                        </div>
                        <div style={sourceTextStyle(uiScale)}>{row.sourceText}</div>
                        <textarea
                            onChange={(event) => handleDraftChange(key, event.currentTarget.value, row.value)}
                            rows={3}
                            style={textareaStyle(uiScale, key in draftValues)}
                            value={draftValue}
                        />
                        <div style={locationListStyle(uiScale)}>
                            {row.locations.slice(0, 3).map((location, index) => (
                                <button
                                    className="toolbar-btn"
                                    key={`${key}-${location.sceneName}-${index}`}
                                    onClick={() => void openSourceLocation(location)}
                                    style={locationButtonStyle(uiScale)}
                                    title="Open source command"
                                    type="button"
                                >
                                    <ExternalLink size={12 * uiScale} />
                                    <span>{location.sceneName} @ {location.path.join('.')}</span>
                                </button>
                            ))}
                            {row.locations.length > 3 ? (
                                <span style={{ color: t.text.faint, fontSize: `${11 * uiScale}px` }}>+{row.locations.length - 3} more</span>
                            ) : undefined}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function actionButtonStyle(uiScale: number, disabled: boolean): CSSProperties {
    return {
        alignItems: 'center',
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: disabled ? t.text.faint : t.text.primary,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        fontSize: `${12 * uiScale}px`,
        gap: `${6 * uiScale}px`,
        justifyContent: 'center',
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
        whiteSpace: 'nowrap',
    };
}

function basename(path: string): string {
    return path.split(/[\\/]/).pop() || path;
}

function EmptyPanelMessage({ message, uiScale }: { message: string; uiScale: number }) {
    return (
        <div style={{ color: t.text.faint, fontStyle: 'italic', padding: `${12 * uiScale}px` }}>
            {message}
        </div>
    );
}

async function ensureLocaleManifestEntry(projectPath: string, locale: string, manifestLocalePath: string): Promise<void> {
    const manifestPath = await fsJoin(projectPath, 'game.json');
    const rawManifest = JSON.parse(await fsReadTextFile(manifestPath)) as Record<string, unknown>;
    const localization = isRecord(rawManifest.localization) ? rawManifest.localization : {};
    const locales = isRecord(localization.locales) ? localization.locales : {};

    rawManifest.localization = {
        ...localization,
        defaultLocale: typeof localization.defaultLocale === 'string' ? localization.defaultLocale : locale,
        locales: {
            ...locales,
            [locale]: manifestLocalePath,
        },
    };

    await fsWriteTextFile(manifestPath, JSON.stringify(rawManifest, undefined, 4));
}

function filterRows(rows: ReturnType<typeof buildLocalizationPanelRows>, query: string) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return rows;

    return rows.filter((row) => (
        row.lineId.toLowerCase().includes(normalizedQuery)
        || toLocalizationEntryKey(row.namespace, row.lineId).toLowerCase().includes(normalizedQuery)
        || row.namespace.toLowerCase().includes(normalizedQuery)
        || row.sourceText.toLowerCase().includes(normalizedQuery)
        || row.value.toLowerCase().includes(normalizedQuery)
    ));
}

function headerStyle(uiScale: number): CSSProperties {
    return {
        alignItems: 'center',
        display: 'flex',
        gap: `${8 * uiScale}px`,
        justifyContent: 'space-between',
    };
}

function iconButtonStyle(uiScale: number): CSSProperties {
    return {
        alignItems: 'center',
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: t.text.primary,
        display: 'inline-flex',
        justifyContent: 'center',
        padding: `${6 * uiScale}px`,
    };
}

function inputStyle(uiScale: number): CSSProperties {
    return {
        background: t.bg.input,
        border: `1px solid ${t.border.input}`,
        borderRadius: t.radius.sm,
        color: t.text.primary,
        fontSize: `${12 * uiScale}px`,
        minWidth: 0,
        outline: 'none',
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
        width: '100%',
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function locationButtonStyle(uiScale: number): CSSProperties {
    return {
        alignItems: 'center',
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: t.text.muted,
        display: 'inline-flex',
        fontSize: `${11 * uiScale}px`,
        gap: `${4 * uiScale}px`,
        padding: `${3 * uiScale}px ${5 * uiScale}px`,
    };
}

function locationListStyle(uiScale: number): CSSProperties {
    return {
        alignItems: 'center',
        display: 'flex',
        flexWrap: 'wrap',
        gap: `${5 * uiScale}px`,
    };
}

async function openSourceLocation(location: LocalizationPanelRowLocation): Promise<void> {
    if (!location.sourcePath) return;

    await openProjectEntry(location.sourcePath, basename(location.sourcePath), { forceView: 'timeline' });
    const editor = useEditorStore.getState();
    editor.setSelectedNodePaths([location.path]);
    editor.setSelectionAnchorPath(location.path);

    if (typeof globalThis.dispatchEvent === 'function' && typeof globalThis.CustomEvent === 'function') {
        globalThis.dispatchEvent(new globalThis.CustomEvent('zerith:dock-select', { detail: DOCK_PANELS.editor }));
    }
}

function panelStyle(uiScale: number): CSSProperties {
    return {
        background: t.bg.app,
        color: t.text.normal,
        display: 'flex',
        flexDirection: 'column',
        gap: `${8 * uiScale}px`,
        height: '100%',
        overflow: 'auto',
        padding: `${10 * uiScale}px`,
    };
}

async function resolveProjectPath(projectPath: string, manifestPath: string): Promise<string> {
    const normalized = manifestPath.startsWith('/') ? manifestPath.slice(1) : manifestPath;
    return fsJoin(projectPath, normalized);
}

function rowHeaderStyle(uiScale: number): CSSProperties {
    return {
        alignItems: 'start',
        display: 'grid',
        gap: `${8 * uiScale}px`,
        gridTemplateColumns: 'minmax(0, 1fr) auto',
    };
}

function rowStyle(uiScale: number): CSSProperties {
    return {
        background: t.bg.panel,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        display: 'grid',
        gap: `${6 * uiScale}px`,
        padding: `${8 * uiScale}px`,
    };
}

function saveRowStyle(uiScale: number): CSSProperties {
    return {
        alignItems: 'center',
        display: 'grid',
        gap: `${6 * uiScale}px`,
        gridTemplateColumns: 'minmax(0, 1fr) auto',
    };
}

function sourceTextStyle(uiScale: number): CSSProperties {
    return {
        background: t.bg.popup,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: t.text.muted,
        fontSize: `${11 * uiScale}px`,
        overflowWrap: 'anywhere',
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
    };
}

function statusBadgeStyle(status: 'missing' | 'same' | 'translated', uiScale: number): CSSProperties {
    const color = status === 'missing'
        ? t.accent.red
        : (status === 'translated' ? t.accent.green : t.text.faint);

    return {
        border: `1px solid ${color}`,
        borderRadius: t.radius.sm,
        color,
        fontSize: `${10 * uiScale}px`,
        padding: `${2 * uiScale}px ${5 * uiScale}px`,
        textTransform: 'uppercase',
    };
}

function statusStyle(kind: 'error' | 'ok', uiScale: number): CSSProperties {
    const color = kind === 'ok' ? t.accent.green : t.accent.red;
    return {
        alignItems: 'center',
        border: `1px solid ${color}`,
        borderRadius: t.radius.sm,
        color,
        display: 'flex',
        gap: `${6 * uiScale}px`,
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
    };
}

function SummaryChip({
    label,
    tone,
    uiScale,
    value,
}: {
    label: string;
    tone?: 'bad' | 'good' | 'warn';
    uiScale: number;
    value: number;
}) {
    const color = summaryToneColor(tone);

    return (
        <div style={summaryChipStyle(uiScale)}>
            <span style={{ color: t.text.faint }}>{label}</span>
            <strong style={{ color }}>{value}</strong>
        </div>
    );
}

function summaryChipStyle(uiScale: number): CSSProperties {
    return {
        background: t.bg.panel,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        display: 'grid',
        gap: `${2 * uiScale}px`,
        minWidth: `${70 * uiScale}px`,
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
    };
}

function summaryGridStyle(uiScale: number): CSSProperties {
    return {
        display: 'grid',
        gap: `${6 * uiScale}px`,
        gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))',
    };
}

function summaryToneColor(tone: 'bad' | 'good' | 'warn' | undefined): string {
    switch (tone) {
        case 'bad': {
            return t.accent.red;
        }
        case 'good': {
            return t.accent.green;
        }
        case 'warn': {
            return t.accent.yellow;
        }
        default: {
            return t.text.normal;
        }
    }
}

function textareaStyle(uiScale: number, dirty: boolean): CSSProperties {
    return {
        background: t.bg.input,
        border: `1px solid ${dirty ? t.border.accent : t.border.input}`,
        borderRadius: t.radius.sm,
        color: t.text.primary,
        font: 'inherit',
        fontSize: `${12 * uiScale}px`,
        minHeight: `${66 * uiScale}px`,
        outline: 'none',
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
        resize: 'vertical',
        width: '100%',
    };
}

function toolbarGridStyle(uiScale: number): CSSProperties {
    return {
        display: 'grid',
        gap: `${6 * uiScale}px`,
        gridTemplateColumns: 'minmax(90px, 0.7fr) minmax(120px, 1fr) auto',
    };
}
