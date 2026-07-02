import type { LocaleBundle, Script } from '@zeffuro/zerith-core';

import { collectTextLocalizationReferences, resolveLocalizedText } from '@zeffuro/zerith-core/utils/Localization';

import type { ScriptPath } from '../../utils/scriptPathUtilities';

export type LocalizationPanelRow = {
    issueSeverity: LocalizationPanelRowIssueSeverity;
    kind: 'choice-option' | 'dialogue' | 'unused';
    lineId: string;
    locations: LocalizationPanelRowLocation[];
    namespace: string;
    sourceText: string;
    status: LocalizationPanelRowStatus;
    value: string;
};

export type LocalizationPanelRowFilter = {
    issueSeverity?: 'all' | LocalizationPanelRowIssueSeverity;
    namespace?: string;
    query?: string;
    status?: 'all' | LocalizationPanelRowStatus;
};

export type LocalizationPanelRowIssueSeverity = 'error' | 'none' | 'warning';

export type LocalizationPanelRowLocation = {
    path: ScriptPath;
    sceneName: string;
    sourcePath?: string;
};

export type LocalizationPanelRowStatus = 'missing' | 'same' | 'translated' | 'unused';

export type LocalizationPanelSummary = {
    missing: number;
    namespaces: string[];
    same: number;
    total: number;
    translated: number;
    unused: number;
};

export type LocalizationRoundTripDocument = {
    entries: LocalizationRoundTripEntry[];
    locale: string;
    schemaVersion: 1;
    type: 'zerith.localizationRoundTrip';
};

export type LocalizationRoundTripEntry = {
    kind: LocalizationPanelRow['kind'];
    lineId: string;
    namespace: string;
    sourceText: string;
    status: LocalizationPanelRowStatus;
    value: string;
};

export type LocalizationSceneInputs = {
    sceneNamespaces: Record<string, string | undefined>;
    scenePaths: Record<string, string | undefined>;
    scenes: Record<string, Script>;
};

export function buildLocalizationPanelRows(
    input: LocalizationSceneInputs,
    bundle?: LocaleBundle,
): LocalizationPanelRow[] {
    const grouped = new Map<string, LocalizationPanelRow>();

    for (const [sceneName, commands] of Object.entries(input.scenes)) {
        const namespace = input.sceneNamespaces[sceneName] ?? toDefaultSceneNamespace(sceneName);
        const references = collectTextLocalizationReferences(commands, { namespace });

        for (const reference of references) {
            const key = toEntryKey(namespace, reference.lineId);
            const existing = grouped.get(key);
            const location = {
                path: reference.path,
                sceneName,
                sourcePath: input.scenePaths[sceneName],
            };

            if (existing) {
                existing.locations.push(location);
                continue;
            }

            const value = bundle
                ? resolveLocalizedText(bundle, reference.lineId, { namespace }) ?? ''
                : '';
            const status = toRowStatus(value, reference.text);
            grouped.set(key, {
                issueSeverity: toRowIssueSeverity(status),
                kind: reference.kind ?? 'dialogue',
                lineId: reference.lineId,
                locations: [location],
                namespace,
                sourceText: reference.text,
                status,
                value,
            });
        }
    }

    if (bundle) {
        for (const [namespace, entries] of Object.entries(bundle.namespaces)) {
            for (const [lineId, value] of Object.entries(entries)) {
                const key = toEntryKey(namespace, lineId);
                if (grouped.has(key)) continue;

                grouped.set(key, {
                    issueSeverity: 'warning',
                    kind: 'unused',
                    lineId,
                    locations: [],
                    namespace,
                    sourceText: '',
                    status: 'unused',
                    value,
                });
            }
        }
    }

    return [...grouped.values()].toSorted((left, right) => (
        left.namespace.localeCompare(right.namespace)
        || left.lineId.localeCompare(right.lineId)
    ));
}

export function createLocaleBundleFromRows(locale: string, rows: LocalizationPanelRow[]): LocaleBundle {
    const bundle: LocaleBundle = {
        $schema: 'zerith/locale',
        locale,
        namespaces: {},
        schemaVersion: 2,
    };

    for (const row of rows) {
        if (row.status === 'unused') continue;
        const namespace = bundle.namespaces[row.namespace] ?? {};
        namespace[row.lineId] = row.sourceText;
        bundle.namespaces[row.namespace] = namespace;
    }

    return sortLocaleBundle(bundle);
}

export function createLocalizationPanelSummary(rows: readonly LocalizationPanelRow[]): LocalizationPanelSummary {
    const namespaces = new Set<string>();
    const summary: LocalizationPanelSummary = {
        missing: 0,
        namespaces: [],
        same: 0,
        total: rows.length,
        translated: 0,
        unused: 0,
    };

    for (const row of rows) {
        namespaces.add(row.namespace);
        summary[row.status] += 1;
    }

    return {
        ...summary,
        namespaces: [...namespaces].toSorted((left, right) => left.localeCompare(right)),
    };
}

export function createLocalizationRoundTripDocument(
    locale: string,
    rows: readonly LocalizationPanelRow[],
    draftValues: Record<string, string> = {},
): LocalizationRoundTripDocument {
    return {
        entries: rows
            .map((row) => {
                const key = toEntryKey(row.namespace, row.lineId);
                return {
                    kind: row.kind,
                    lineId: row.lineId,
                    namespace: row.namespace,
                    sourceText: row.sourceText,
                    status: row.status,
                    value: draftValues[key] ?? row.value,
                };
            })
            .toSorted((left, right) => (
                left.namespace.localeCompare(right.namespace)
                || left.lineId.localeCompare(right.lineId)
            )),
        locale,
        schemaVersion: 1,
        type: 'zerith.localizationRoundTrip',
    };
}

export function createMissingLocaleEntryDrafts(rows: readonly LocalizationPanelRow[]): Record<string, string> {
    const updates: Record<string, string> = {};
    for (const row of rows) {
        if (row.status !== 'missing') continue;
        updates[toEntryKey(row.namespace, row.lineId)] = row.sourceText;
    }
    return updates;
}

export function createTranslatorImportDrafts(
    value: unknown,
): { locale?: string; updates: Record<string, string> } {
    const document = parseLocalizationRoundTripDocument(value);
    const updates: Record<string, string> = {};
    for (const entry of document.entries) {
        updates[toEntryKey(entry.namespace, entry.lineId)] = entry.value;
    }

    return {
        locale: document.locale,
        updates,
    };
}

export function filterLocalizationPanelRows(
    rows: readonly LocalizationPanelRow[],
    filter: LocalizationPanelRowFilter,
): LocalizationPanelRow[] {
    const normalizedQuery = filter.query?.trim().toLocaleLowerCase() ?? '';
    const namespace = filter.namespace?.trim();

    return rows.filter((row) => {
        if (filter.status && filter.status !== 'all' && row.status !== filter.status) return false;
        if (filter.issueSeverity && filter.issueSeverity !== 'all' && row.issueSeverity !== filter.issueSeverity) return false;
        if (namespace && namespace !== 'all' && row.namespace !== namespace) return false;
        if (!normalizedQuery) return true;

        return [
            row.lineId,
            toEntryKey(row.namespace, row.lineId),
            row.namespace,
            row.sourceText,
            row.value,
            row.status,
            row.kind,
        ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
    });
}

export function getLocaleManifestPath(locale: string): string {
    return `/locales/${sanitizeLocaleFileName(locale)}.json`;
}

export function getLocalizationRoundTripFileName(locale: string): string {
    return `${sanitizeLocaleFileName(locale)}.translator.json`;
}

export function pruneUnusedLocaleBundleEntries(
    bundle: LocaleBundle,
    rows: readonly LocalizationPanelRow[],
): LocaleBundle {
    const unusedKeys = new Set(
        rows
            .filter((row) => row.status === 'unused')
            .map((row) => toEntryKey(row.namespace, row.lineId)),
    );
    if (unusedKeys.size === 0) return sortLocaleBundle(bundle);

    const next: LocaleBundle = {
        ...bundle,
        namespaces: {},
    };

    for (const [namespace, entries] of Object.entries(bundle.namespaces)) {
        const nextEntries = Object.fromEntries(
            Object.entries(entries).filter(([lineId]) => !unusedKeys.has(toEntryKey(namespace, lineId))),
        );
        if (Object.keys(nextEntries).length > 0) {
            next.namespaces[namespace] = nextEntries;
        }
    }

    return sortLocaleBundle(next);
}

export function toLocalizationEntryKey(namespace: string, lineId: string): string {
    return toEntryKey(namespace, lineId);
}

export function updateLocaleBundleEntries(
    bundle: LocaleBundle,
    updates: Record<string, string>,
): LocaleBundle {
    const next: LocaleBundle = {
        ...bundle,
        namespaces: Object.fromEntries(
            Object.entries(bundle.namespaces).map(([namespace, entries]) => [
                namespace,
                { ...entries },
            ]),
        ),
    };

    for (const [key, value] of Object.entries(updates)) {
        const [namespace, lineId] = splitEntryKey(key);
        if (!namespace || !lineId) continue;
        const namespaceEntries = next.namespaces[namespace] ?? {};
        namespaceEntries[lineId] = value;
        next.namespaces[namespace] = namespaceEntries;
    }

    return sortLocaleBundle(next);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseLocalizationRoundTripDocument(value: unknown): LocalizationRoundTripDocument {
    if (!isRecord(value)) {
        throw new TypeError('Translator file must be a JSON object.');
    }

    const entries = Array.isArray(value.entries) ? value.entries : undefined;
    if (!entries) {
        throw new TypeError('Translator file is missing an entries array.');
    }

    return {
        entries: entries.map((entry) => parseLocalizationRoundTripEntry(entry)),
        locale: typeof value.locale === 'string' ? value.locale : '',
        schemaVersion: 1,
        type: 'zerith.localizationRoundTrip',
    };
}

function parseLocalizationRoundTripEntry(value: unknown): LocalizationRoundTripEntry {
    if (!isRecord(value)) {
        throw new TypeError('Translator entry must be a JSON object.');
    }

    if (typeof value.namespace !== 'string' || typeof value.lineId !== 'string') {
        throw new TypeError('Translator entry is missing namespace or lineId.');
    }

    if (typeof value.value !== 'string') {
        throw new TypeError(`Translator entry ${value.namespace}:${value.lineId} is missing a string value.`);
    }

    return {
        kind: parseLocalizationRoundTripEntryKind(value.kind),
        lineId: value.lineId,
        namespace: value.namespace,
        sourceText: typeof value.sourceText === 'string' ? value.sourceText : '',
        status: parseLocalizationRoundTripEntryStatus(value.status),
        value: value.value,
    };
}

function parseLocalizationRoundTripEntryKind(value: unknown): LocalizationRoundTripEntry['kind'] {
    switch (value) {
        case 'choice-option':
        case 'dialogue':
        case 'unused': {
            return value;
        }
        default: {
            return 'dialogue';
        }
    }
}

function parseLocalizationRoundTripEntryStatus(value: unknown): LocalizationPanelRowStatus {
    switch (value) {
        case 'missing':
        case 'same':
        case 'translated':
        case 'unused': {
            return value;
        }
        default: {
            return 'translated';
        }
    }
}

function sanitizeLocaleFileName(locale: string): string {
    const normalized = locale.trim().toLowerCase().replaceAll(/[^a-z0-9._-]+/gu, '-');
    return normalized || 'locale';
}

function sortLocaleBundle(bundle: LocaleBundle): LocaleBundle {
    return {
        ...bundle,
        namespaces: Object.fromEntries(
            Object.entries(bundle.namespaces)
                .toSorted(([left], [right]) => left.localeCompare(right))
                .map(([namespace, entries]) => [
                    namespace,
                    Object.fromEntries(
                        Object.entries(entries).toSorted(([left], [right]) => left.localeCompare(right)),
                    ),
                ]),
        ),
    };
}

function splitEntryKey(key: string): [string | undefined, string | undefined] {
    const separatorIndex = key.indexOf(':');
    if (separatorIndex === -1) return [undefined, undefined];
    return [key.slice(0, separatorIndex), key.slice(separatorIndex + 1)];
}

function toDefaultSceneNamespace(sceneName: string): string {
    return `scene.${sceneName}`;
}

function toEntryKey(namespace: string, lineId: string): string {
    return `${namespace}:${lineId}`;
}

function toRowIssueSeverity(status: LocalizationPanelRowStatus): LocalizationPanelRowIssueSeverity {
    switch (status) {
        case 'missing': {
            return 'error';
        }
        case 'same':
        case 'unused': {
            return 'warning';
        }
        case 'translated': {
            return 'none';
        }
    }
}

function toRowStatus(value: string, sourceText: string): LocalizationPanelRow['status'] {
    if (value.length === 0) return 'missing';
    return value === sourceText ? 'same' : 'translated';
}
