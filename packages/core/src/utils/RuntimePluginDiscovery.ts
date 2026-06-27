import type {
    RegisteredRuntimePlugin,
    RuntimePlugin,
    RuntimePluginCapability,
    RuntimePluginManifest,
} from '../types/RuntimePlugin';

import { CURRENT_RUNTIME_PLUGIN_API_VERSION } from '../types/RuntimePlugin';

export type DiscoveredRuntimePlugin = {
    load: () => Promise<RuntimePlugin> | RuntimePlugin;
    manifest: RuntimePluginManifest;
    source: string;
};

export type RegisterRuntimePluginFunction = (
    plugin: RuntimePlugin,
) => Promise<RegisteredRuntimePlugin> | RegisteredRuntimePlugin;

export type RejectedRuntimePlugin = {
    manifestId?: string;
    reason: string;
    source: string;
};

export type RuntimePluginDiscoveryCandidate = {
    load: () => Promise<RuntimePlugin> | RuntimePlugin;
    manifest: unknown;
    source: string;
};

export type RuntimePluginDiscoveryResult = {
    discovered: DiscoveredRuntimePlugin[];
    rejected: RejectedRuntimePlugin[];
};

export type RuntimePluginLoadResult = {
    registered: RegisteredRuntimePlugin[];
    rejected: RejectedRuntimePlugin[];
};

const RUNTIME_PLUGIN_CAPABILITIES = new Set<RuntimePluginCapability>([
    'commands',
    'events',
    'overlays',
    'state',
]);

export function discoverRuntimePluginCandidates(
    candidates: readonly RuntimePluginDiscoveryCandidate[],
): RuntimePluginDiscoveryResult {
    const discovered: DiscoveredRuntimePlugin[] = [];
    const rejected: RejectedRuntimePlugin[] = [];

    for (const candidate of candidates) {
        const parsed = parseRuntimePluginManifest(candidate.manifest);
        if (!parsed.ok) {
            rejected.push({ reason: parsed.reason, source: candidate.source });
            continue;
        }

        const compatibilityError = getRuntimePluginCompatibilityError(parsed.manifest);
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

export function getRuntimePluginCompatibilityError(manifest: RuntimePluginManifest): string | undefined {
    if (
        manifest.pluginApiVersion !== undefined
        && manifest.pluginApiVersion !== CURRENT_RUNTIME_PLUGIN_API_VERSION
    ) {
        return `targets plugin API v${manifest.pluginApiVersion}, but this runtime supports v${CURRENT_RUNTIME_PLUGIN_API_VERSION}`;
    }

    return;
}

export async function loadDiscoveredRuntimePlugins(
    candidates: readonly RuntimePluginDiscoveryCandidate[],
    registerPlugin: RegisterRuntimePluginFunction,
): Promise<RuntimePluginLoadResult> {
    const discovery = discoverRuntimePluginCandidates(candidates);
    const registered: RegisteredRuntimePlugin[] = [];
    const rejected: RejectedRuntimePlugin[] = [...discovery.rejected];

    for (const plugin of discovery.discovered) {
        try {
            const contribution = await plugin.load();
            const manifestCheck = parseRuntimePluginManifest(contribution.manifest);
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

            registered.push(await registerPlugin(contribution));
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

export function parseRuntimePluginManifest(
    value: unknown,
): { manifest: RuntimePluginManifest; ok: true } | { ok: false; reason: string } {
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

    const engineVersion = parseOptionalString(value.engineVersion, 'engineVersion');
    if (!engineVersion.ok) return engineVersion;

    return {
        manifest: {
            ...(capabilities.value.length === 0 ? {} : { capabilities: capabilities.value }),
            ...(engineVersion.value === undefined ? {} : { engineVersion: engineVersion.value }),
            id: id.value,
            name: name.value,
            ...(pluginApiVersion.value === undefined ? {} : { pluginApiVersion: pluginApiVersion.value }),
            version: version.value,
        },
        ok: true,
    };
}

function getManifestMismatchReason(
    expected: RuntimePluginManifest,
    actual: RuntimePluginManifest,
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

    return;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCapabilities(
    value: unknown,
): { ok: false; reason: string } | { ok: true; value: RuntimePluginCapability[] } {
    if (value === undefined) return { ok: true, value: [] };
    if (!Array.isArray(value)) {
        return { ok: false, reason: 'capabilities must be an array' };
    }

    const capabilities = new Set<RuntimePluginCapability>();
    for (const entry of value) {
        if (typeof entry !== 'string' || !RUNTIME_PLUGIN_CAPABILITIES.has(entry as RuntimePluginCapability)) {
            return { ok: false, reason: `unknown capability '${String(entry)}'` };
        }
        capabilities.add(entry as RuntimePluginCapability);
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
