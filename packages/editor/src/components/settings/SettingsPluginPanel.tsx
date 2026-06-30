import { CheckCircle2, Copy, FileSearch, FolderInput, PackageOpen, XCircle } from 'lucide-react';
import { useState } from 'react';

import type { EditorPluginLoadResult } from '../../plugins/pluginDiscovery';
import type { EditorPluginManifestInspection, EditorPluginSourceRecordInspection } from '../../plugins/pluginManifestInspection';

import { getAllPlugins, getRegisteredEditorPlugins, registerEditorPlugin } from '../../plugins/commandPlugins';
import {
    createEditorPluginInstallPlan,
    createEditorPluginSourceRecord,
    inspectEditorPluginManifestText,
    inspectEditorPluginSourceRecordText,
    serializeEditorPluginSourceRecord,
} from '../../plugins/pluginManifestInspection';
import { loadInstalledEditorPluginPackages } from '../../plugins/pluginPackageLoader';
import { installEditorPluginSourceRecord } from '../../plugins/pluginSourceInstaller';
import {
    createEditorPluginManifestTrustPolicy,
    createEditorPluginSourceRecordTrustPolicy,
    type EditorPluginTrustPolicy,
} from '../../plugins/pluginTrustPolicy';
import { fsPickBinaryFiles, fsPickDirectory } from '../../services/fs';
import { editorTheme as t } from '../../theme/editorTheme';
import { createInstalledPluginLoadSummary } from './pluginSettingsModel';

type SettingsPluginPanelProperties = {
    uiScale: number;
};

export function SettingsPluginPanel({ uiScale }: SettingsPluginPanelProperties) {
    const [installedPackageLoadResult, setInstalledPackageLoadResult] = useState<EditorPluginLoadResult>();
    const [installedPackageLoadRoot, setInstalledPackageLoadRoot] = useState<string>();
    const [inspection, setInspection] = useState<EditorPluginManifestInspection>();
    const [isLoadingInstalledPackages, setIsLoadingInstalledPackages] = useState(false);
    const [isInstallingSourceRecord, setIsInstallingSourceRecord] = useState(false);
    const [, bumpPluginRegistryRevision] = useState(0);
    const [sourceRecordInstallMessage, setSourceRecordInstallMessage] = useState<string>();
    const [sourceRecordInspection, setSourceRecordInspection] = useState<EditorPluginSourceRecordInspection>();
    const [sourceRecordMessage, setSourceRecordMessage] = useState<string>();
    const registeredPlugins = getRegisteredEditorPlugins();
    const commandPlugins = getAllPlugins();
    const contributedCommandTypes = new Set(registeredPlugins.flatMap((plugin) => plugin.commandTypes));
    const builtInCommandCount = commandPlugins.filter((plugin) => !contributedCommandTypes.has(plugin.type)).length;
    const installPlan = inspection ? createEditorPluginInstallPlan(inspection) : undefined;
    const manifestTrustPolicy = inspection ? createEditorPluginManifestTrustPolicy(inspection) : undefined;
    const sourceRecord = installPlan ? createEditorPluginSourceRecord(installPlan) : undefined;
    const sourceRecordTrustPolicy = sourceRecordInspection
        ? createEditorPluginSourceRecordTrustPolicy(sourceRecordInspection)
        : undefined;
    const installedPackageLoadSummary = installedPackageLoadResult
        ? createInstalledPluginLoadSummary(installedPackageLoadResult)
        : undefined;

    const handleInspectManifest = () => {
        void (async () => {
            try {
                setInspection(undefined);
                setSourceRecordInstallMessage(undefined);
                setSourceRecordInspection(undefined);
                setSourceRecordMessage(undefined);
                const [file] = await fsPickBinaryFiles({
                    filters: [{ extensions: ['json'], name: 'Plugin Manifest' }],
                    multiple: false,
                    title: 'Inspect plugin manifest',
                });
                if (!file) return;

                const text = new TextDecoder().decode(file.bytes);
                const source = file.path ?? file.name;
                if (isPluginSourceRecordText(text)) {
                    setSourceRecordInspection(inspectEditorPluginSourceRecordText(text, source));
                    return;
                }

                setInspection(inspectEditorPluginManifestText(text, source));
            } catch (error) {
                setInspection({
                    reason: error instanceof Error ? error.message : String(error),
                    source: 'selected manifest',
                    status: 'rejected',
                });
            }
        })();
    };

    const handleCopySourceRecord = () => {
        if (!sourceRecord || sourceRecord.status !== 'ready') return;

        void (async () => {
            try {
                const clipboard = globalThis.navigator?.clipboard;
                if (!clipboard) {
                    throw new Error('Clipboard API is unavailable.');
                }

                await clipboard.writeText(serializeEditorPluginSourceRecord(sourceRecord.record));
                setSourceRecordMessage('Source record copied.');
            } catch (error) {
                setSourceRecordMessage(error instanceof Error ? error.message : String(error));
            }
        })();
    };

    const handleInstallSourceRecordPackage = () => {
        if (sourceRecordInspection?.status !== 'ready') return;

        void (async () => {
            try {
                setIsInstallingSourceRecord(true);
                setSourceRecordInstallMessage(undefined);
                const { record } = sourceRecordInspection;
                const installRoot = record.install.targetPath
                    ? undefined
                    : await fsPickDirectory('Select plugin install folder');
                if (!record.install.targetPath && !installRoot) return;

                const result = await installEditorPluginSourceRecord(record, { installRoot });
                setSourceRecordInstallMessage(`Copied package to ${result.targetPath} (${result.copiedFiles.length} files).`);
            } catch (error) {
                setSourceRecordInstallMessage(error instanceof Error ? error.message : String(error));
            } finally {
                setIsInstallingSourceRecord(false);
            }
        })();
    };

    const handleLoadInstalledPackages = () => {
        void (async () => {
            let installRoot: string | undefined;
            try {
                setIsLoadingInstalledPackages(true);
                installRoot = await fsPickDirectory('Select installed plugin folder');
                if (!installRoot) return;

                setInstalledPackageLoadRoot(installRoot);
                const result = await loadInstalledEditorPluginPackages(installRoot, registerEditorPlugin);
                setInstalledPackageLoadResult(result);
                bumpPluginRegistryRevision((current) => current + 1);
            } catch (error) {
                setInstalledPackageLoadRoot(installRoot);
                setInstalledPackageLoadResult({
                    registered: [],
                    rejected: [{
                        reason: error instanceof Error ? error.message : String(error),
                        source: installRoot ?? 'selected plugin folder',
                    }],
                });
            } finally {
                setIsLoadingInstalledPackages(false);
            }
        })();
    };

    return (
        <>
            <section aria-busy={isInstallingSourceRecord} style={sectionStyle(uiScale)}>
                <div style={sectionHeaderStyle()}>
                    <span>Manifest Inspector</span>
                    <button
                        className="toolbar-btn"
                        onClick={handleInspectManifest}
                        style={inspectButtonStyle(uiScale)}
                        type="button"
                    >
                        <FileSearch size={13 * uiScale} />
                        <span>Inspect Manifest...</span>
                    </button>
                </div>

                {sourceRecordInspection ? (
                    <article style={pluginRowStyle(uiScale)}>
                        <div style={{ alignItems: 'center', display: 'flex', gap: `${8 * uiScale}px`, justifyContent: 'space-between' }}>
                            <div style={{ alignItems: 'center', color: t.text.primary, display: 'flex', fontWeight: 700, gap: `${6 * uiScale}px` }}>
                                {sourceRecordInspection.status === 'ready'
                                    ? <CheckCircle2 color={t.accent.green} size={14 * uiScale} />
                                    : <XCircle color={t.accent.red} size={14 * uiScale} />}
                                <span>{sourceRecordInspection.status === 'ready' ? 'Source Record Ready' : 'Source Record Rejected'}</span>
                            </div>
                            <span style={statusStyle(sourceRecordInspection.status === 'ready', uiScale)}>
                                {sourceRecordInspection.status === 'ready' ? 'Compatible' : 'Blocked'}
                            </span>
                        </div>
                        <div style={metadataStyle(uiScale)}>{sourceRecordInspection.source}</div>
                        {sourceRecordInspection.status === 'ready' ? (
                            <>
                                <div style={metadataStyle(uiScale)}>
                                    {sourceRecordInspection.record.manifest.id} | v{sourceRecordInspection.record.manifest.version}
                                </div>
                                <div style={installPlanStyle(uiScale)}>
                                    <MetadataLine label="Manifest" uiScale={uiScale} value={sourceRecordInspection.record.manifestPath} />
                                    <MetadataLine label="Package Root" uiScale={uiScale} value={sourceRecordInspection.record.packageRoot ?? 'Source path unavailable'} />
                                    <MetadataLine label="Entry" uiScale={uiScale} value={sourceRecordInspection.record.entryPath ?? 'Not declared'} />
                                    <MetadataLine label="Install Folder" uiScale={uiScale} value={sourceRecordInspection.record.install.directoryName} />
                                    {sourceRecordInspection.record.install.targetPath ? (
                                        <MetadataLine label="Install Target" uiScale={uiScale} value={sourceRecordInspection.record.install.targetPath} />
                                    ) : undefined}
                                    {sourceRecordTrustPolicy ? (
                                        <MetadataLine label="Load Policy" uiScale={uiScale} value={formatPluginTrustPolicy(sourceRecordTrustPolicy)} />
                                    ) : undefined}
                                    <button
                                        disabled={isInstallingSourceRecord || !sourceRecordInspection.record.packageRoot}
                                        onClick={handleInstallSourceRecordPackage}
                                        style={inspectButtonStyle(uiScale, isInstallingSourceRecord || !sourceRecordInspection.record.packageRoot)}
                                        type="button"
                                    >
                                        <FolderInput size={13 * uiScale} />
                                        <span>{isInstallingSourceRecord ? 'Copying Package...' : 'Copy Package...'}</span>
                                    </button>
                                    {sourceRecordInstallMessage ? (
                                        <div
                                            aria-live="polite"
                                            role="status"
                                            style={{ color: sourceRecordInstallMessage.startsWith('Copied package') ? t.accent.green : t.accent.red, fontSize: `${11 * uiScale}px`, overflowWrap: 'anywhere' }}
                                        >
                                            {sourceRecordInstallMessage}
                                        </div>
                                    ) : undefined}
                                </div>
                            </>
                        ) : (
                            <div style={{ color: t.accent.red, fontSize: `${11 * uiScale}px`, overflowWrap: 'anywhere' }}>
                                {sourceRecordInspection.reason}
                            </div>
                        )}
                    </article>
                ) : undefined}

                {!sourceRecordInspection && inspection ? (
                    <article style={pluginRowStyle(uiScale)}>
                        <div style={{ alignItems: 'center', display: 'flex', gap: `${8 * uiScale}px`, justifyContent: 'space-between' }}>
                            <div style={{ alignItems: 'center', color: t.text.primary, display: 'flex', fontWeight: 700, gap: `${6 * uiScale}px` }}>
                                {inspection.status === 'ready'
                                    ? <CheckCircle2 color={t.accent.green} size={14 * uiScale} />
                                    : <XCircle color={t.accent.red} size={14 * uiScale} />}
                                <span>{inspection.status === 'ready' ? 'Ready to Install' : 'Rejected'}</span>
                            </div>
                            <span style={statusStyle(inspection.status === 'ready', uiScale)}>
                                {inspection.status === 'ready' ? 'Compatible' : 'Blocked'}
                            </span>
                        </div>
                        <div style={metadataStyle(uiScale)}>{inspection.source}</div>
                        {inspection.manifest ? (
                            <>
                                <div style={metadataStyle(uiScale)}>
                                    {inspection.manifest.id} | v{inspection.manifest.version}
                                </div>
                                <div style={chipRowStyle(uiScale)}>
                                    {(inspection.manifest.capabilities ?? []).map((capability) => (
                                        <span key={`inspected-${capability}`} style={chipStyle(uiScale)}>{capability}</span>
                                    ))}
                                    {inspection.manifest.pluginApiVersion ? (
                                        <span style={chipStyle(uiScale)}>plugin API v{inspection.manifest.pluginApiVersion}</span>
                                    ) : undefined}
                                </div>
                                {installPlan?.status === 'ready' ? (
                                    <div style={installPlanStyle(uiScale)}>
                                        <MetadataLine label="Package Root" uiScale={uiScale} value={installPlan.packageRoot ?? 'Source path unavailable'} />
                                        <MetadataLine label="Entry" uiScale={uiScale} value={installPlan.entryPath ?? 'Not declared'} />
                                        <MetadataLine label="Suggested Folder" uiScale={uiScale} value={installPlan.installDirectoryName} />
                                        {manifestTrustPolicy ? (
                                            <MetadataLine label="Load Policy" uiScale={uiScale} value={formatPluginTrustPolicy(manifestTrustPolicy)} />
                                        ) : undefined}
                                        <button
                                            disabled={sourceRecord?.status !== 'ready'}
                                            onClick={handleCopySourceRecord}
                                            style={inspectButtonStyle(uiScale, sourceRecord?.status !== 'ready')}
                                            type="button"
                                        >
                                            <Copy size={13 * uiScale} />
                                            <span>Copy Source Record</span>
                                        </button>
                                        {sourceRecordMessage ? (
                                            <div
                                                aria-live="polite"
                                                role="status"
                                                style={{ color: sourceRecordMessage.endsWith('copied.') ? t.accent.green : t.accent.red, fontSize: `${11 * uiScale}px`, overflowWrap: 'anywhere' }}
                                            >
                                                {sourceRecordMessage}
                                            </div>
                                        ) : undefined}
                                    </div>
                                ) : undefined}
                            </>
                        ) : undefined}
                        {inspection.status === 'rejected' ? (
                            <div style={{ color: t.accent.red, fontSize: `${11 * uiScale}px`, overflowWrap: 'anywhere' }}>
                                {inspection.reason}
                            </div>
                        ) : undefined}
                    </article>
                ) : undefined}

                {!sourceRecordInspection && !inspection ? (
                    <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                        No manifest inspected.
                    </div>
                ) : undefined}
            </section>

            <section aria-busy={isLoadingInstalledPackages} style={sectionStyle(uiScale)}>
                <div style={sectionHeaderStyle()}>
                    <span>Installed Package Loader</span>
                    <button
                        className="toolbar-btn"
                        disabled={isLoadingInstalledPackages}
                        onClick={handleLoadInstalledPackages}
                        style={inspectButtonStyle(uiScale, isLoadingInstalledPackages)}
                        type="button"
                    >
                        <PackageOpen size={13 * uiScale} />
                        <span>{isLoadingInstalledPackages ? 'Loading Packages...' : 'Load Folder...'}</span>
                    </button>
                </div>

                {installedPackageLoadSummary ? (
                    <article aria-live="polite" role="status" style={pluginRowStyle(uiScale)}>
                        <div style={{ alignItems: 'center', display: 'flex', gap: `${8 * uiScale}px`, justifyContent: 'space-between' }}>
                            <div style={{ alignItems: 'center', color: t.text.primary, display: 'flex', fontWeight: 700, gap: `${6 * uiScale}px` }}>
                                {installedPackageLoadSummary.tone === 'error'
                                    ? <XCircle color={t.accent.red} size={14 * uiScale} />
                                    : <CheckCircle2 color={installedPackageLoadSummary.tone === 'muted' ? t.text.faint : t.accent.green} size={14 * uiScale} />}
                                <span>{installedPackageLoadSummary.message}</span>
                            </div>
                            <span style={statusStyle(installedPackageLoadSummary.rejectedCount === 0, uiScale)}>
                                {installedPackageLoadSummary.rejectedCount === 0 ? 'Ready' : 'Review'}
                            </span>
                        </div>
                        {installedPackageLoadRoot ? (
                            <div style={metadataStyle(uiScale)}>{installedPackageLoadRoot}</div>
                        ) : undefined}
                        <div style={chipRowStyle(uiScale)}>
                            <span style={chipStyle(uiScale)}>loaded {installedPackageLoadSummary.registeredCount}</span>
                            <span style={chipStyle(uiScale)}>blocked {installedPackageLoadSummary.rejectedCount}</span>
                        </div>
                        {installedPackageLoadResult?.rejected.length ? (
                            <div style={rejectedListStyle(uiScale)}>
                                {installedPackageLoadResult.rejected.map((rejection) => (
                                    <div key={`${rejection.source}-${rejection.reason}`} style={rejectedRowStyle(uiScale)}>
                                        <div style={{ color: t.accent.red, fontSize: `${11 * uiScale}px`, overflowWrap: 'anywhere' }}>
                                            {rejection.reason}
                                        </div>
                                        <div style={metadataStyle(uiScale)}>
                                            {rejection.manifestId ? `${rejection.manifestId} | ` : undefined}
                                            {rejection.source}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : undefined}
                    </article>
                ) : (
                    <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                        No install folder loaded.
                    </div>
                )}
            </section>

            <section style={sectionStyle(uiScale)}>
                <div style={sectionHeaderStyle()}>
                    <span>Plugin Packages</span>
                    <span style={countStyle(uiScale)}>{registeredPlugins.length}</span>
                </div>

                {registeredPlugins.length === 0 ? (
                    <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                        No plugin packages are registered.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: `${8 * uiScale}px` }}>
                        {registeredPlugins.map((plugin) => (
                            <article key={plugin.manifest.id} style={pluginRowStyle(uiScale)}>
                                <div style={{ alignItems: 'center', display: 'flex', gap: `${8 * uiScale}px`, justifyContent: 'space-between' }}>
                                    <div style={{ color: t.text.primary, fontWeight: 700 }}>{plugin.manifest.name}</div>
                                    <span style={statusStyle(plugin.active, uiScale)}>{plugin.active ? 'Active' : 'Inactive'}</span>
                                </div>
                                <div style={metadataStyle(uiScale)}>
                                    {plugin.manifest.id} | v{plugin.manifest.version}
                                </div>
                                {plugin.source ? <div style={metadataStyle(uiScale)}>{plugin.source}</div> : undefined}
                                {plugin.manifest.entry ? <div style={metadataStyle(uiScale)}>entry: {plugin.manifest.entry}</div> : undefined}
                                <div style={chipRowStyle(uiScale)}>
                                    {plugin.capabilities.map((capability) => (
                                        <span key={`${plugin.manifest.id}-${capability}`} style={chipStyle(uiScale)}>{capability}</span>
                                    ))}
                                    {plugin.commandTypes.map((type) => (
                                        <span key={`${plugin.manifest.id}-${type}`} style={chipStyle(uiScale)}>{type}</span>
                                    ))}
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            <section style={sectionStyle(uiScale)}>
                <div style={sectionHeaderStyle()}>
                    <span>Command Catalog</span>
                    <span style={countStyle(uiScale)}>{commandPlugins.length}</span>
                </div>
                <div style={summaryGridStyle(uiScale)}>
                    <SummaryCell label="Built-In" uiScale={uiScale} value={builtInCommandCount} />
                    <SummaryCell label="Plugin Commands" uiScale={uiScale} value={contributedCommandTypes.size} />
                    <SummaryCell label="Packages" uiScale={uiScale} value={registeredPlugins.length} />
                </div>
            </section>
        </>
    );
}

function chipRowStyle(uiScale: number) {
    return {
        display: 'flex',
        flexWrap: 'wrap' as const,
        gap: `${6 * uiScale}px`,
        marginTop: `${6 * uiScale}px`,
    };
}

function chipStyle(uiScale: number) {
    return {
        background: t.bg.panel,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: t.text.normal,
        fontSize: `${11 * uiScale}px`,
        padding: `${2 * uiScale}px ${6 * uiScale}px`,
    };
}

function countStyle(uiScale: number) {
    return {
        color: t.text.faint,
        fontSize: `${12 * uiScale}px`,
        fontWeight: 500,
    };
}

function formatPluginTrustPolicy(policy: EditorPluginTrustPolicy): string {
    return `${formatPluginTrustStatus(policy.status)} | ${policy.codeLoadPolicy} | ${policy.reason}`;
}

function formatPluginTrustStatus(status: EditorPluginTrustPolicy['status']): string {
    return status.replaceAll('-', ' ');
}

function inspectButtonStyle(uiScale: number, disabled = false) {
    return {
        alignItems: 'center',
        border: `1px solid ${t.border.button}`,
        borderRadius: t.radius.sm,
        color: t.text.normal,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        fontSize: `${11 * uiScale}px`,
        gap: `${4 * uiScale}px`,
        opacity: disabled ? 0.6 : 1,
        padding: `${4 * uiScale}px ${8 * uiScale}px`,
        whiteSpace: 'nowrap',
    } as const;
}

function installPlanStyle(uiScale: number) {
    return {
        borderTop: `1px solid ${t.border.subtle}`,
        display: 'grid',
        gap: `${3 * uiScale}px`,
        marginTop: `${4 * uiScale}px`,
        paddingTop: `${6 * uiScale}px`,
    };
}

function isPluginSourceRecordText(text: string): boolean {
    try {
        const value = JSON.parse(text) as unknown;
        return typeof value === 'object'
            && value !== null
            && !Array.isArray(value)
            && (value as { type?: unknown }).type === 'zerith.editorPluginSource';
    } catch {
        return false;
    }
}

function MetadataLine({ label, uiScale, value }: { label: string; uiScale: number; value: string }) {
    return (
        <div style={{ color: t.text.faint, fontSize: `${11 * uiScale}px`, overflowWrap: 'anywhere' }}>
            <span style={{ color: t.text.muted }}>{label}: </span>
            {value}
        </div>
    );
}

function metadataStyle(uiScale: number) {
    return {
        color: t.text.faint,
        fontSize: `${11 * uiScale}px`,
        overflowWrap: 'anywhere' as const,
    };
}

function pluginRowStyle(uiScale: number) {
    return {
        background: t.bg.panel,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.md,
        display: 'grid',
        gap: `${4 * uiScale}px`,
        padding: `${8 * uiScale}px`,
    };
}

function rejectedListStyle(uiScale: number) {
    return {
        borderTop: `1px solid ${t.border.subtle}`,
        display: 'grid',
        gap: `${6 * uiScale}px`,
        marginTop: `${4 * uiScale}px`,
        paddingTop: `${6 * uiScale}px`,
    };
}

function rejectedRowStyle(uiScale: number) {
    return {
        display: 'grid',
        gap: `${2 * uiScale}px`,
    };
}

function sectionHeaderStyle() {
    return {
        alignItems: 'center',
        color: t.text.primary,
        display: 'flex',
        fontWeight: 700,
        justifyContent: 'space-between',
    };
}

function sectionStyle(uiScale: number) {
    return {
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.md,
        display: 'grid',
        gap: `${8 * uiScale}px`,
        padding: `${10 * uiScale}px`,
    };
}

function statusStyle(active: boolean, uiScale: number) {
    return {
        border: `1px solid ${active ? t.accent.green : t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: active ? t.accent.green : t.text.faint,
        fontSize: `${11 * uiScale}px`,
        padding: `${2 * uiScale}px ${6 * uiScale}px`,
    };
}

function SummaryCell({ label, uiScale, value }: { label: string; uiScale: number; value: number }) {
    return (
        <div style={summaryCellStyle(uiScale)}>
            <div style={{ color: t.text.faint, fontSize: `${11 * uiScale}px` }}>{label}</div>
            <div style={{ color: t.text.primary, fontSize: `${18 * uiScale}px`, fontWeight: 700 }}>{value}</div>
        </div>
    );
}

function summaryCellStyle(uiScale: number) {
    return {
        background: t.bg.panel,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.md,
        display: 'grid',
        gap: `${4 * uiScale}px`,
        padding: `${8 * uiScale}px`,
    };
}

function summaryGridStyle(uiScale: number) {
    return {
        display: 'grid',
        gap: `${8 * uiScale}px`,
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    };
}
