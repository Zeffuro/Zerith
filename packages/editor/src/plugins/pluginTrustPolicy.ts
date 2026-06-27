import type {
    EditorPluginManifestInspection,
    EditorPluginSourceRecord,
    EditorPluginSourceRecordInspection,
} from './pluginManifestInspection';

export type EditorPluginCodeLoadPolicy =
    | 'blocked'
    | 'explicit-installed-load'
    | 'metadata-only';

export type EditorPluginTrustPolicy = {
    codeLoadPolicy: EditorPluginCodeLoadPolicy;
    reason: string;
    status: EditorPluginTrustStatus;
};

export type EditorPluginTrustStatus =
    | 'blocked'
    | 'manual-review'
    | 'ready-to-load';

export function createEditorPluginManifestTrustPolicy(
    inspection: EditorPluginManifestInspection,
): EditorPluginTrustPolicy {
    if (inspection.status === 'rejected') {
        return {
            codeLoadPolicy: 'blocked',
            reason: inspection.reason,
            status: 'blocked',
        };
    }

    return {
        codeLoadPolicy: 'metadata-only',
        reason: 'Raw manifest inspection validates metadata only; install a source record before loading plugin code.',
        status: 'manual-review',
    };
}

export function createEditorPluginSourceRecordTrustPolicy(
    inspection: EditorPluginSourceRecordInspection,
): EditorPluginTrustPolicy {
    if (inspection.status === 'rejected') {
        return {
            codeLoadPolicy: 'blocked',
            reason: inspection.reason,
            status: 'blocked',
        };
    }

    if (!inspection.record.install.targetPath) {
        return {
            codeLoadPolicy: 'metadata-only',
            reason: 'Source record is installable, but code loading waits until the copied package records an install target.',
            status: 'manual-review',
        };
    }

    return createInstalledEditorPluginLoadTrustPolicy(inspection.record);
}

export function createInstalledEditorPluginLoadTrustPolicy(
    record: EditorPluginSourceRecord,
): EditorPluginTrustPolicy {
    if (!record.install.targetPath) {
        return {
            codeLoadPolicy: 'blocked',
            reason: 'source record install.targetPath is required before loading an installed plugin package',
            status: 'blocked',
        };
    }

    if (!record.manifest.entry) {
        return {
            codeLoadPolicy: 'blocked',
            reason: 'plugin manifest entry is required before loading an installed plugin package',
            status: 'blocked',
        };
    }

    return {
        codeLoadPolicy: 'explicit-installed-load',
        reason: 'Installed source-record package can load only through an explicit installed-folder load action.',
        status: 'ready-to-load',
    };
}
