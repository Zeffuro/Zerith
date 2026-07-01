import type { EditorPluginLoadResult } from '../../plugins/pluginDiscovery';
import type { EditorPluginSourceRecordInspection } from '../../plugins/pluginManifestInspection';

export type InstalledPluginLoadSummary = {
    message: string;
    registeredCount: number;
    rejectedCount: number;
    tone: 'error' | 'muted' | 'success' | 'warning';
};

export type PluginMarketplaceReadinessReport = {
    blocked: number;
    limited: number;
    ready: number;
    requirements: PluginMarketplaceRequirement[];
    status: PluginMarketplaceRequirementStatus;
};

export type PluginMarketplaceRequirement = {
    detail: string;
    id: PluginMarketplaceRequirementId;
    label: string;
    status: PluginMarketplaceRequirementStatus;
    summary: string;
};

export type PluginMarketplaceRequirementId =
    | 'codeLoadConsent'
    | 'installedPackageLoader'
    | 'manifestTrustPolicy'
    | 'packageIntegrity'
    | 'remoteCatalogSource'
    | 'updateRollbackPolicy';

export type PluginMarketplaceRequirementStatus = 'blocked' | 'limited' | 'ready';

export type PluginSourceRecordIntegritySummary = {
    message: string;
    status: 'blocked' | 'limited' | 'ready';
};

const PLUGIN_MARKETPLACE_REQUIREMENTS: readonly PluginMarketplaceRequirement[] = [
    {
        detail: 'Manifest and source-record inspection already report compatibility, capabilities, package roots, entries, and explicit load policy.',
        id: 'manifestTrustPolicy',
        label: 'Manifest trust policy',
        status: 'ready',
        summary: 'Local manifests are inspected before install or load.',
    },
    {
        detail: 'Installed package loading is manual and reports registered and rejected packages without hiding executable code loading.',
        id: 'installedPackageLoader',
        label: 'Installed package loader',
        status: 'ready',
        summary: 'Local package loading is explicit and reviewable.',
    },
    {
        detail: 'Source records separate metadata inspection from package copy/load, preserving a visible consent step.',
        id: 'codeLoadConsent',
        label: 'Executable code consent',
        status: 'ready',
        summary: 'Plugin code is not loaded as part of metadata-only inspection.',
    },
    {
        detail: 'There is no trusted remote catalog URL, schema version, moderation boundary, or offline cache policy for marketplace discovery.',
        id: 'remoteCatalogSource',
        label: 'Remote catalog source',
        status: 'blocked',
        summary: 'Do not add marketplace browsing before a catalog contract exists.',
    },
    {
        detail: 'Installed source records now store local package file hashes and verify them before loading, but remote packages still need signatures, publisher identity, and provenance checks.',
        id: 'packageIntegrity',
        label: 'Package integrity',
        status: 'limited',
        summary: 'Local installed packages are hash-checked; remote marketplace provenance is still missing.',
    },
    {
        detail: 'Installed plugins can be manually deactivated from Settings, but marketplace installs still need explicit update, downgrade, and rollback behavior before automatic discovery is safe.',
        id: 'updateRollbackPolicy',
        label: 'Lifecycle policy',
        status: 'limited',
        summary: 'Local deactivation exists; catalog update and rollback policy is still missing.',
    },
];

export function createInstalledPluginLoadSummary(result: EditorPluginLoadResult): InstalledPluginLoadSummary {
    const registeredCount = result.registered.length;
    const rejectedCount = result.rejected.length;

    if (registeredCount === 0 && rejectedCount === 0) {
        return {
            message: 'No installed plugin packages found.',
            registeredCount,
            rejectedCount,
            tone: 'muted',
        };
    }

    if (rejectedCount === 0) {
        return {
            message: `Loaded ${registeredCount} plugin package${registeredCount === 1 ? '' : 's'}.`,
            registeredCount,
            rejectedCount,
            tone: 'success',
        };
    }

    if (registeredCount === 0) {
        return {
            message: `Blocked ${rejectedCount} plugin package${rejectedCount === 1 ? '' : 's'}.`,
            registeredCount,
            rejectedCount,
            tone: 'error',
        };
    }

    return {
        message: `Loaded ${registeredCount} plugin package${registeredCount === 1 ? '' : 's'}; blocked ${rejectedCount}.`,
        registeredCount,
        rejectedCount,
        tone: 'warning',
    };
}

export function createPluginMarketplaceReadinessReport(): PluginMarketplaceReadinessReport {
    const requirements = PLUGIN_MARKETPLACE_REQUIREMENTS.map((requirement) => ({ ...requirement }));
    const ready = requirements.filter((requirement) => requirement.status === 'ready').length;
    const limited = requirements.filter((requirement) => requirement.status === 'limited').length;
    const blocked = requirements.filter((requirement) => requirement.status === 'blocked').length;

    return {
        blocked,
        limited,
        ready,
        requirements,
        status: blocked > 0 ? 'blocked' : (limited > 0 ? 'limited' : 'ready'),
    };
}

export function createPluginSourceRecordIntegritySummary(
    inspection: EditorPluginSourceRecordInspection,
): PluginSourceRecordIntegritySummary {
    if (inspection.status === 'rejected') {
        return {
            message: 'Source record rejected before package integrity could be inspected.',
            status: 'blocked',
        };
    }

    const integrity = inspection.record.packageIntegrity;
    if (!integrity) {
        return {
            message: 'No package integrity metadata; legacy source record remains metadata-only until load.',
            status: 'limited',
        };
    }

    return {
        message: `${integrity.files.length} ${integrity.algorithm} file hash${integrity.files.length === 1 ? '' : 'es'} recorded.`,
        status: 'ready',
    };
}
