import type { EditorPluginManifest } from './types';

import { getEditorPluginCompatibilityError, parseEditorPluginManifest } from './pluginDiscovery';

export const EDITOR_PLUGIN_SOURCE_RECORD_SCHEMA_VERSION = 1;

export type EditorPluginInstallPlan =
    | {
        entryPath?: string;
        installDirectoryName: string;
        installTargetPath?: string;
        manifest: EditorPluginManifest;
        manifestPath: string;
        packageRoot?: string;
        source: string;
        status: 'ready';
    }
    | {
        manifest?: EditorPluginManifest;
        reason: string;
        source: string;
        status: 'rejected';
    };

export type EditorPluginManifestInspection =
    | {
        manifest: EditorPluginManifest;
        source: string;
        status: 'ready';
    }
    | {
        manifest?: EditorPluginManifest;
        reason: string;
        source: string;
        status: 'rejected';
    };

export type EditorPluginPackageIntegrity = {
    algorithm: 'sha256';
    files: EditorPluginPackageIntegrityFile[];
};

export type EditorPluginPackageIntegrityFile = {
    path: string;
    sha256: string;
    size: number;
};

export type EditorPluginSourceRecord = {
    entryPath?: string;
    install: {
        directoryName: string;
        targetPath?: string;
    };
    manifest: EditorPluginManifest;
    manifestPath: string;
    packageIntegrity?: EditorPluginPackageIntegrity;
    packageRoot?: string;
    schemaVersion: typeof EDITOR_PLUGIN_SOURCE_RECORD_SCHEMA_VERSION;
    source: string;
    type: 'zerith.editorPluginSource';
};

export type EditorPluginSourceRecordInspection =
    | {
        manifest?: EditorPluginManifest;
        reason: string;
        source: string;
        status: 'rejected';
    }
    | {
        record: EditorPluginSourceRecord;
        source: string;
        status: 'ready';
    };

export type EditorPluginSourceRecordResult =
    | {
        reason: string;
        status: 'rejected';
    }
    | {
        record: EditorPluginSourceRecord;
        status: 'ready';
    };

export function createEditorPluginInstallPlan(
    inspection: EditorPluginManifestInspection,
    options: { installRoot?: string } = {},
): EditorPluginInstallPlan {
    if (inspection.status === 'rejected') {
        return {
            manifest: inspection.manifest,
            reason: inspection.reason,
            source: inspection.source,
            status: 'rejected',
        };
    }

    const sourcePath = splitSourcePath(inspection.source);
    const installDirectoryName = toPluginInstallDirectoryName(inspection.manifest.id);

    return {
        ...(inspection.manifest.entry === undefined
            ? {}
            : { entryPath: joinDisplayPath(sourcePath.packageRoot, inspection.manifest.entry) }),
        installDirectoryName,
        ...(options.installRoot === undefined
            ? {}
            : { installTargetPath: joinDisplayPath(options.installRoot, installDirectoryName) }),
        manifest: inspection.manifest,
        manifestPath: sourcePath.manifestPath,
        ...(sourcePath.packageRoot === undefined ? {} : { packageRoot: sourcePath.packageRoot }),
        source: inspection.source,
        status: 'ready',
    };
}

export function createEditorPluginSourceRecord(plan: EditorPluginInstallPlan): EditorPluginSourceRecordResult {
    if (plan.status === 'rejected') {
        return {
            reason: plan.reason,
            status: 'rejected',
        };
    }

    return {
        record: {
            ...(plan.entryPath === undefined ? {} : { entryPath: plan.entryPath }),
            install: {
                directoryName: plan.installDirectoryName,
                ...(plan.installTargetPath === undefined ? {} : { targetPath: plan.installTargetPath }),
            },
            manifest: plan.manifest,
            manifestPath: plan.manifestPath,
            ...(plan.packageRoot === undefined ? {} : { packageRoot: plan.packageRoot }),
            schemaVersion: EDITOR_PLUGIN_SOURCE_RECORD_SCHEMA_VERSION,
            source: plan.source,
            type: 'zerith.editorPluginSource',
        },
        status: 'ready',
    };
}

export function inspectEditorPluginManifestText(
    text: string,
    source = 'selected manifest',
): EditorPluginManifestInspection {
    let parsedJson: unknown;

    try {
        parsedJson = JSON.parse(text) as unknown;
    } catch (error) {
        return {
            reason: `invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
            source,
            status: 'rejected',
        };
    }

    const parsedManifest = parseEditorPluginManifest(parsedJson);
    if (!parsedManifest.ok) {
        return {
            reason: parsedManifest.reason,
            source,
            status: 'rejected',
        };
    }

    const compatibilityError = getEditorPluginCompatibilityError(parsedManifest.manifest);
    if (compatibilityError) {
        return {
            manifest: parsedManifest.manifest,
            reason: compatibilityError,
            source,
            status: 'rejected',
        };
    }

    return {
        manifest: parsedManifest.manifest,
        source,
        status: 'ready',
    };
}

export function inspectEditorPluginSourceRecordText(
    text: string,
    source = 'selected source record',
): EditorPluginSourceRecordInspection {
    let parsedJson: unknown;

    try {
        parsedJson = JSON.parse(text) as unknown;
    } catch (error) {
        return {
            reason: `invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
            source,
            status: 'rejected',
        };
    }

    return inspectEditorPluginSourceRecordValue(parsedJson, source);
}

export function inspectEditorPluginSourceRecordValue(
    value: unknown,
    source = 'selected source record',
): EditorPluginSourceRecordInspection {
    if (!isRecord(value)) {
        return {
            reason: 'source record must be an object',
            source,
            status: 'rejected',
        };
    }

    if (value.type !== 'zerith.editorPluginSource') {
        return {
            reason: 'source record type must be zerith.editorPluginSource',
            source,
            status: 'rejected',
        };
    }

    if (value.schemaVersion !== EDITOR_PLUGIN_SOURCE_RECORD_SCHEMA_VERSION) {
        return {
            reason: `source record schema version must be ${EDITOR_PLUGIN_SOURCE_RECORD_SCHEMA_VERSION}`,
            source,
            status: 'rejected',
        };
    }

    const manifestResult = parseEditorPluginManifest(value.manifest);
    if (!manifestResult.ok) {
        return {
            reason: `source record manifest is invalid: ${manifestResult.reason}`,
            source,
            status: 'rejected',
        };
    }

    const compatibilityError = getEditorPluginCompatibilityError(manifestResult.manifest);
    if (compatibilityError) {
        return {
            manifest: manifestResult.manifest,
            reason: compatibilityError,
            source,
            status: 'rejected',
        };
    }

    const install = value.install;
    if (!isRecord(install)) {
        return {
            manifest: manifestResult.manifest,
            reason: 'source record install metadata must be an object',
            source,
            status: 'rejected',
        };
    }

    const directoryName = parseRecordString(install.directoryName, 'install.directoryName');
    if (!directoryName.ok) {
        return {
            manifest: manifestResult.manifest,
            reason: directoryName.reason,
            source,
            status: 'rejected',
        };
    }

    const expectedDirectoryName = toPluginInstallDirectoryName(manifestResult.manifest.id);
    if (directoryName.value !== expectedDirectoryName) {
        return {
            manifest: manifestResult.manifest,
            reason: `install.directoryName must be '${expectedDirectoryName}'`,
            source,
            status: 'rejected',
        };
    }

    const sourcePath = parseRecordString(value.source, 'source');
    if (!sourcePath.ok) {
        return {
            manifest: manifestResult.manifest,
            reason: sourcePath.reason,
            source,
            status: 'rejected',
        };
    }

    const manifestPath = parseRecordString(value.manifestPath, 'manifestPath');
    if (!manifestPath.ok) {
        return {
            manifest: manifestResult.manifest,
            reason: manifestPath.reason,
            source,
            status: 'rejected',
        };
    }

    const entryPath = parseOptionalRecordString(value.entryPath, 'entryPath');
    if (!entryPath.ok) {
        return {
            manifest: manifestResult.manifest,
            reason: entryPath.reason,
            source,
            status: 'rejected',
        };
    }

    const packageRoot = parseOptionalRecordString(value.packageRoot, 'packageRoot');
    if (!packageRoot.ok) {
        return {
            manifest: manifestResult.manifest,
            reason: packageRoot.reason,
            source,
            status: 'rejected',
        };
    }

    const installTargetPath = parseOptionalRecordString(install.targetPath, 'install.targetPath');
    if (!installTargetPath.ok) {
        return {
            manifest: manifestResult.manifest,
            reason: installTargetPath.reason,
            source,
            status: 'rejected',
        };
    }

    const packageIntegrity = parseOptionalPackageIntegrity(value.packageIntegrity);
    if (!packageIntegrity.ok) {
        return {
            manifest: manifestResult.manifest,
            reason: packageIntegrity.reason,
            source,
            status: 'rejected',
        };
    }

    const expectedEntryPath = manifestResult.manifest.entry && packageRoot.value
        ? joinDisplayPath(packageRoot.value, manifestResult.manifest.entry)
        : undefined;
    if (expectedEntryPath !== undefined && entryPath.value !== expectedEntryPath) {
        return {
            manifest: manifestResult.manifest,
            reason: `entryPath must be '${expectedEntryPath}'`,
            source,
            status: 'rejected',
        };
    }

    return {
        record: {
            ...(entryPath.value === undefined ? {} : { entryPath: entryPath.value }),
            install: {
                directoryName: directoryName.value,
                ...(installTargetPath.value === undefined ? {} : { targetPath: installTargetPath.value }),
            },
            manifest: manifestResult.manifest,
            manifestPath: manifestPath.value,
            ...(packageRoot.value === undefined ? {} : { packageRoot: packageRoot.value }),
            ...(packageIntegrity.value === undefined ? {} : { packageIntegrity: packageIntegrity.value }),
            schemaVersion: EDITOR_PLUGIN_SOURCE_RECORD_SCHEMA_VERSION,
            source: sourcePath.value,
            type: 'zerith.editorPluginSource',
        },
        source,
        status: 'ready',
    };
}

export function serializeEditorPluginSourceRecord(record: EditorPluginSourceRecord): string {
    return `${JSON.stringify(record, undefined, 4)}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function joinDisplayPath(root: string | undefined, child: string): string {
    if (!root) return child;

    const normalizedRoot = root.replaceAll('\\', '/').replaceAll(/\/+$/gu, '');
    const normalizedChild = child.replaceAll('\\', '/').replaceAll(/^\/+/gu, '');
    return `${normalizedRoot}/${normalizedChild}`;
}

function normalizePackageIntegrityPath(path: string): string {
    return path.trim().replaceAll('\\', '/').replaceAll(/^\/+/gu, '');
}

function parseOptionalPackageIntegrity(
    value: unknown,
): { ok: false; reason: string } | { ok: true; value?: EditorPluginPackageIntegrity } {
    if (value === undefined) return { ok: true };

    if (!isRecord(value)) {
        return { ok: false, reason: 'packageIntegrity must be an object' };
    }

    if (value.algorithm !== 'sha256') {
        return { ok: false, reason: 'packageIntegrity.algorithm must be sha256' };
    }

    if (!Array.isArray(value.files)) {
        return { ok: false, reason: 'packageIntegrity.files must be an array' };
    }

    const files: EditorPluginPackageIntegrityFile[] = [];
    const paths = new Set<string>();

    for (const [index, file] of value.files.entries()) {
        if (!isRecord(file)) {
            return { ok: false, reason: `packageIntegrity.files[${index}] must be an object` };
        }

        const path = parseRecordString(file.path, `packageIntegrity.files[${index}].path`);
        if (!path.ok) return path;

        const normalizedPath = normalizePackageIntegrityPath(path.value);
        if (normalizedPath.length === 0 || normalizedPath.split('/').includes('..')) {
            return { ok: false, reason: `packageIntegrity.files[${index}].path must be a relative package path` };
        }

        if (paths.has(normalizedPath)) {
            return { ok: false, reason: `packageIntegrity.files[${index}].path must be unique` };
        }
        paths.add(normalizedPath);

        const sha256 = file.sha256;
        if (typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(sha256)) {
            return { ok: false, reason: `packageIntegrity.files[${index}].sha256 must be a lowercase sha256 hex digest` };
        }

        const size = file.size;
        if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0) {
            return { ok: false, reason: `packageIntegrity.files[${index}].size must be a non-negative integer` };
        }

        files.push({
            path: normalizedPath,
            sha256,
            size,
        });
    }

    return {
        ok: true,
        value: {
            algorithm: 'sha256',
            files: files.toSorted((left, right) => left.path.localeCompare(right.path)),
        },
    };
}

function parseOptionalRecordString(
    value: unknown,
    key: string,
): { ok: false; reason: string } | { ok: true; value?: string } {
    if (value === undefined) return { ok: true };
    return parseRecordString(value, key);
}

function parseRecordString(
    value: unknown,
    key: string,
): { ok: false; reason: string } | { ok: true; value: string } {
    if (typeof value !== 'string' || value.trim() === '') {
        return { ok: false, reason: `${key} must be a non-empty string` };
    }

    return { ok: true, value: value.trim().replaceAll('\\', '/') };
}

function splitSourcePath(source: string): { manifestPath: string; packageRoot?: string } {
    const normalized = source.replaceAll('\\', '/');
    const separatorIndex = normalized.lastIndexOf('/');
    if (separatorIndex <= 0) {
        return { manifestPath: source };
    }

    return {
        manifestPath: normalized,
        packageRoot: normalized.slice(0, separatorIndex),
    };
}

function toPluginInstallDirectoryName(pluginId: string): string {
    const normalized = pluginId
        .toLowerCase()
        .replaceAll(/[^a-z0-9._-]+/gu, '-')
        .replaceAll(/^-+|-+$/gu, '');

    return normalized || 'plugin';
}
