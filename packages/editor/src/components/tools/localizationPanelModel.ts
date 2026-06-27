import type { LocaleBundle, Script } from 'core';

import { collectTextLocalizationReferences, resolveLocalizedText } from 'core/utils/Localization';

import type { ScriptPath } from '../../utils/scriptPathUtilities';

export type LocalizationPanelRow = {
    kind: 'choice-option' | 'dialogue';
    lineId: string;
    locations: LocalizationPanelRowLocation[];
    namespace: string;
    sourceText: string;
    status: 'missing' | 'same' | 'translated';
    value: string;
};

export type LocalizationPanelRowLocation = {
    path: ScriptPath;
    sceneName: string;
    sourcePath?: string;
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
            grouped.set(key, {
                kind: reference.kind ?? 'dialogue',
                lineId: reference.lineId,
                locations: [location],
                namespace,
                sourceText: reference.text,
                status: toRowStatus(value, reference.text),
                value,
            });
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
        const namespace = bundle.namespaces[row.namespace] ?? {};
        namespace[row.lineId] = row.sourceText;
        bundle.namespaces[row.namespace] = namespace;
    }

    return sortLocaleBundle(bundle);
}

export function getLocaleManifestPath(locale: string): string {
    return `/locales/${sanitizeLocaleFileName(locale)}.json`;
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

function toRowStatus(value: string, sourceText: string): LocalizationPanelRow['status'] {
    if (value.length === 0) return 'missing';
    return value === sourceText ? 'same' : 'translated';
}
