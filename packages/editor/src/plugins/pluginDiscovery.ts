import type {
    EditorPluginCapability,
    EditorPluginContribution,
    EditorPluginManifest,
    RegisteredEditorPlugin,
} from './types';

import { CURRENT_EDITOR_PLUGIN_API_VERSION } from './types';

export type DiscoveredEditorPlugin = {
    load: () => EditorPluginContribution | Promise<EditorPluginContribution>;
    manifest: EditorPluginManifest;
    source: string;
};

export type EditorPluginDiscoveryCandidate = {
    load: () => EditorPluginContribution | Promise<EditorPluginContribution>;
    manifest: unknown;
    source: string;
};

export type EditorPluginDiscoveryResult = {
    discovered: DiscoveredEditorPlugin[];
    rejected: RejectedEditorPlugin[];
};

export type EditorPluginLoadResult = {
    registered: RegisteredEditorPlugin[];
    rejected: RejectedEditorPlugin[];
};

export type RegisterEditorPluginFunction = (
    contribution: EditorPluginContribution,
    options?: { source?: string },
) => RegisteredEditorPlugin;

export type RejectedEditorPlugin = {
    manifestId?: string;
    reason: string;
    source: string;
};

const EDITOR_PLUGIN_CAPABILITIES = new Set<EditorPluginCapability>([
    'commands',
    'graphNodes',
    'inspectors',
    'templates',
    'toolbarActions',
    'validators',
]);

export function discoverEditorPluginCandidates(
    candidates: readonly EditorPluginDiscoveryCandidate[],
): EditorPluginDiscoveryResult {
    const discovered: DiscoveredEditorPlugin[] = [];
    const rejected: RejectedEditorPlugin[] = [];

    for (const candidate of candidates) {
        const parsed = parseEditorPluginManifest(candidate.manifest);
        if (!parsed.ok) {
            rejected.push({ reason: parsed.reason, source: candidate.source });
            continue;
        }

        const compatibilityError = getEditorPluginCompatibilityError(parsed.manifest);
        if (compatibilityError) {
            rejected.push({
                manifestId: parsed.manifest.id,
                reason: compatibilityError,
                source: candidate.source,
            });
            continue;
        }

        discovered.push({
            load: candidate.load,
            manifest: parsed.manifest,
            source: candidate.source,
        });
    }

    return {
        discovered: discovered.toSorted((left, right) => left.manifest.id.localeCompare(right.manifest.id)),
        rejected: rejected.toSorted((left, right) => left.source.localeCompare(right.source)),
    };
}

export function getEditorPluginCompatibilityError(manifest: EditorPluginManifest): string | undefined {
    if (
        manifest.pluginApiVersion !== undefined
        && manifest.pluginApiVersion !== CURRENT_EDITOR_PLUGIN_API_VERSION
    ) {
        return `targets plugin API v${manifest.pluginApiVersion}, but this editor supports v${CURRENT_EDITOR_PLUGIN_API_VERSION}`;
    }

    return;
}

export async function loadDiscoveredEditorPlugins(
    candidates: readonly EditorPluginDiscoveryCandidate[],
    registerPlugin: RegisterEditorPluginFunction,
): Promise<EditorPluginLoadResult> {
    const discovery = discoverEditorPluginCandidates(candidates);
    const registered: RegisteredEditorPlugin[] = [];
    const rejected: RejectedEditorPlugin[] = [...discovery.rejected];

    for (const plugin of discovery.discovered) {
        try {
            const contribution = await plugin.load();
            const manifestCheck = parseEditorPluginManifest(contribution.manifest);
            if (!manifestCheck.ok) {
                rejected.push({
                    manifestId: plugin.manifest.id,
                    reason: `loaded plugin manifest is invalid: ${manifestCheck.reason}`,
                    source: plugin.source,
                });
                continue;
            }

            const mismatch = getManifestMismatchReason(plugin.manifest, manifestCheck.manifest);
            if (mismatch) {
                rejected.push({
                    manifestId: plugin.manifest.id,
                    reason: mismatch,
                    source: plugin.source,
                });
                continue;
            }

            registered.push(registerPlugin(contribution, { source: plugin.source }));
        } catch (error) {
            rejected.push({
                manifestId: plugin.manifest.id,
                reason: error instanceof Error ? error.message : String(error),
                source: plugin.source,
            });
        }
    }

    return {
        registered: registered.toSorted((left, right) => left.manifest.id.localeCompare(right.manifest.id)),
        rejected: rejected.toSorted((left, right) => left.source.localeCompare(right.source)),
    };
}

export function parseEditorPluginManifest(
    value: unknown,
): { manifest: EditorPluginManifest; ok: true } | { ok: false; reason: string } {
    if (!isRecord(value)) {
        return { ok: false, reason: 'manifest must be an object' };
    }

    const id = readRequiredString(value, 'id');
    if (!id.ok) return id;

    const name = readRequiredString(value, 'name');
    if (!name.ok) return name;

    const version = readRequiredString(value, 'version');
    if (!version.ok) return version;

    const capabilities = parseCapabilities(value.capabilities);
    if (!capabilities.ok) return capabilities;

    const pluginApiVersion = parseOptionalInteger(value.pluginApiVersion, 'pluginApiVersion');
    if (!pluginApiVersion.ok) return pluginApiVersion;

    const description = parseOptionalString(value.description, 'description');
    if (!description.ok) return description;

    const entry = parseOptionalRelativePath(value.entry, 'entry');
    if (!entry.ok) return entry;

    const zerithVersion = parseOptionalString(value.zerithVersion, 'zerithVersion');
    if (!zerithVersion.ok) return zerithVersion;

    return {
        manifest: {
            ...(capabilities.value.length === 0 ? {} : { capabilities: capabilities.value }),
            ...(description.value === undefined ? {} : { description: description.value }),
            ...(entry.value === undefined ? {} : { entry: entry.value }),
            id: id.value,
            name: name.value,
            ...(pluginApiVersion.value === undefined ? {} : { pluginApiVersion: pluginApiVersion.value }),
            version: version.value,
            ...(zerithVersion.value === undefined ? {} : { zerithVersion: zerithVersion.value }),
        },
        ok: true,
    };
}

function getManifestMismatchReason(
    expected: EditorPluginManifest,
    actual: EditorPluginManifest,
): string | undefined {
    if (expected.id !== actual.id) {
        return `loaded plugin id '${actual.id}' does not match discovered id '${expected.id}'`;
    }

    if (expected.version !== actual.version) {
        return `loaded plugin version '${actual.version}' does not match discovered version '${expected.version}'`;
    }

    if (expected.pluginApiVersion !== actual.pluginApiVersion) {
        return 'loaded plugin API version does not match discovered manifest';
    }

    if (expected.entry !== actual.entry) {
        return 'loaded plugin entry does not match discovered manifest';
    }

    return;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCapabilities(
    value: unknown,
): { ok: false; reason: string } | { ok: true; value: EditorPluginCapability[] } {
    if (value === undefined) return { ok: true, value: [] };
    if (!Array.isArray(value)) {
        return { ok: false, reason: 'capabilities must be an array' };
    }

    const capabilities = new Set<EditorPluginCapability>();
    for (const entry of value) {
        if (typeof entry !== 'string' || !EDITOR_PLUGIN_CAPABILITIES.has(entry as EditorPluginCapability)) {
            return { ok: false, reason: `unknown capability '${String(entry)}'` };
        }
        capabilities.add(entry as EditorPluginCapability);
    }

    return {
        ok: true,
        value: [...capabilities].toSorted((left, right) => left.localeCompare(right)),
    };
}

function parseOptionalInteger(
    value: unknown,
    key: string,
): { ok: false; reason: string } | { ok: true; value?: number } {
    if (value === undefined) return { ok: true };
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
        return { ok: false, reason: `${key} must be a positive integer` };
    }

    return { ok: true, value };
}

function parseOptionalRelativePath(
    value: unknown,
    key: string,
): { ok: false; reason: string } | { ok: true; value?: string } {
    const parsed = parseOptionalString(value, key);
    if (!parsed.ok || parsed.value === undefined) return parsed;

    const normalized = parsed.value.replaceAll('\\', '/');
    if (
        normalized.startsWith('/')
        || /^[a-z][a-z0-9+.-]*:/iu.test(normalized)
    ) {
        return { ok: false, reason: `${key} must be a relative path inside the plugin package` };
    }

    const segments = normalized.split('/').filter((segment) => segment !== '.');
    if (segments.length === 0 || segments.some((segment) => segment === '' || segment === '..')) {
        return { ok: false, reason: `${key} must be a relative path inside the plugin package` };
    }

    return { ok: true, value: segments.join('/') };
}

function parseOptionalString(
    value: unknown,
    key: string,
): { ok: false; reason: string } | { ok: true; value?: string } {
    if (value === undefined) return { ok: true };
    if (typeof value !== 'string') {
        return { ok: false, reason: `${key} must be a string` };
    }

    return { ok: true, value: value.trim() };
}

function readRequiredString(
    value: Record<string, unknown>,
    key: string,
): { ok: false; reason: string } | { ok: true; value: string } {
    const raw = value[key];
    if (typeof raw !== 'string' || raw.trim() === '') {
        return { ok: false, reason: `${key} is required` };
    }

    return { ok: true, value: raw.trim() };
}
