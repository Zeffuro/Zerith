import type { FsDirectoryEntry } from '../services/fs';
import type {
    EditorPluginDiscoveryCandidate,
    EditorPluginLoadResult,
    RegisterEditorPluginFunction,
    RejectedEditorPlugin,
} from './pluginDiscovery';
import type { EditorPluginSourceRecord } from './pluginManifestInspection';
import type { EditorPluginContribution } from './types';

import { fsJoin, fsReadDirectory, fsReadTextFile } from '../services/fs';
import { loadDiscoveredEditorPlugins } from './pluginDiscovery';
import { inspectEditorPluginSourceRecordText } from './pluginManifestInspection';
import { createInstalledEditorPluginLoadTrustPolicy } from './pluginTrustPolicy';

export type InstalledEditorPluginPackageDiscoveryDependencies = {
    join: (...parts: string[]) => Promise<string>;
    loadModule: (entryPath: string) => Promise<unknown>;
    readDirectory: (path: string) => Promise<FsDirectoryEntry[]>;
    readTextFile: (path: string) => Promise<string>;
};

export type InstalledEditorPluginPackageDiscoveryOptions = {
    dependencies?: Partial<InstalledEditorPluginPackageDiscoveryDependencies>;
};

export type InstalledEditorPluginPackageDiscoveryResult = {
    candidates: EditorPluginDiscoveryCandidate[];
    rejected: RejectedEditorPlugin[];
};

export const EDITOR_PLUGIN_SOURCE_RECORD_FILE_NAME = 'zerith.editorPluginSource.json';

const DEFAULT_INSTALLED_EDITOR_PLUGIN_PACKAGE_DISCOVERY_DEPENDENCIES: InstalledEditorPluginPackageDiscoveryDependencies = {
    join: fsJoin,
    loadModule: defaultLoadEditorPluginModule,
    readDirectory: fsReadDirectory,
    readTextFile: fsReadTextFile,
};

export async function discoverInstalledEditorPluginPackages(
    installRoot: string,
    options: InstalledEditorPluginPackageDiscoveryOptions = {},
): Promise<InstalledEditorPluginPackageDiscoveryResult> {
    const dependencies = {
        ...DEFAULT_INSTALLED_EDITOR_PLUGIN_PACKAGE_DISCOVERY_DEPENDENCIES,
        ...options.dependencies,
    };
    const candidates: EditorPluginDiscoveryCandidate[] = [];
    const rejected: RejectedEditorPlugin[] = [];
    const entries = await dependencies.readDirectory(installRoot);

    for (const entry of entries) {
        if (!entry.isDirectory || entry.isSymlink) continue;

        const packagePath = await dependencies.join(installRoot, entry.name);
        const recordPath = await dependencies.join(packagePath, EDITOR_PLUGIN_SOURCE_RECORD_FILE_NAME);
        let recordText: string;
        try {
            recordText = await dependencies.readTextFile(recordPath);
        } catch (error) {
            rejected.push({
                reason: `source record could not be read: ${error instanceof Error ? error.message : String(error)}`,
                source: recordPath,
            });
            continue;
        }

        const inspection = inspectEditorPluginSourceRecordText(recordText, recordPath);
        if (inspection.status === 'rejected') {
            rejected.push({
                manifestId: inspection.manifest?.id,
                reason: inspection.reason,
                source: recordPath,
            });
            continue;
        }

        const entryPath = await resolveInstalledEditorPluginEntryPath(inspection.record, dependencies);
        if (!entryPath.ok) {
            rejected.push({
                manifestId: inspection.record.manifest.id,
                reason: entryPath.reason,
                source: recordPath,
            });
            continue;
        }

        candidates.push({
            load: async () => normalizeEditorPluginModule(
                await dependencies.loadModule(entryPath.value),
                entryPath.value,
            ),
            manifest: inspection.record.manifest,
            source: recordPath,
        });
    }

    return {
        candidates: candidates.toSorted((left, right) => (
            readCandidateManifestId(left).localeCompare(readCandidateManifestId(right))
        )),
        rejected: rejected.toSorted((left, right) => left.source.localeCompare(right.source)),
    };
}

export async function loadInstalledEditorPluginPackages(
    installRoot: string,
    registerPlugin: RegisterEditorPluginFunction,
    options: InstalledEditorPluginPackageDiscoveryOptions = {},
): Promise<EditorPluginLoadResult> {
    const discovery = await discoverInstalledEditorPluginPackages(installRoot, options);
    const loadResult = await loadDiscoveredEditorPlugins(discovery.candidates, registerPlugin);

    return {
        registered: loadResult.registered,
        rejected: [...discovery.rejected, ...loadResult.rejected]
            .toSorted((left, right) => left.source.localeCompare(right.source)),
    };
}

async function defaultLoadEditorPluginModule(entryPath: string): Promise<unknown> {
    return import(/* @vite-ignore */ entryPath);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeEditorPluginModule(moduleValue: unknown, entryPath: string): EditorPluginContribution {
    const directContribution = readEditorPluginContribution(moduleValue);
    if (directContribution) return directContribution;

    if (isRecord(moduleValue)) {
        const exportedContribution = readEditorPluginContribution(moduleValue.default)
            ?? readEditorPluginContribution(moduleValue.editorPlugin)
            ?? readEditorPluginContribution(moduleValue.plugin);
        if (exportedContribution) return exportedContribution;
    }

    throw new Error(
        `Plugin module at ${entryPath} must export an editor plugin contribution as default, editorPlugin, plugin, or the module value.`,
    );
}

function readCandidateManifestId(candidate: EditorPluginDiscoveryCandidate): string {
    if (!isRecord(candidate.manifest) || typeof candidate.manifest.id !== 'string') return '';
    return candidate.manifest.id;
}

function readEditorPluginContribution(value: unknown): EditorPluginContribution | undefined {
    if (!isRecord(value) || !isRecord(value.manifest)) return;
    return value as EditorPluginContribution;
}

async function resolveInstalledEditorPluginEntryPath(
    record: EditorPluginSourceRecord,
    dependencies: Pick<InstalledEditorPluginPackageDiscoveryDependencies, 'join'>,
): Promise<{ ok: false; reason: string } | { ok: true; value: string }> {
    const trustPolicy = createInstalledEditorPluginLoadTrustPolicy(record);
    if (trustPolicy.status === 'blocked') {
        return {
            ok: false,
            reason: trustPolicy.reason,
        };
    }

    const targetPath = record.install.targetPath;
    const entry = record.manifest.entry;
    if (!targetPath || !entry) {
        return {
            ok: false,
            reason: trustPolicy.reason,
        };
    }

    return {
        ok: true,
        value: await dependencies.join(targetPath, entry),
    };
}
