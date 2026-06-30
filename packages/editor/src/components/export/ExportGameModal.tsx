import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { useBackdropDismissal } from '../../hooks/useBackdropDismissal';
import { useDialogFocusTrap } from '../../hooks/useDialogFocusTrap';
import {
    type ExportCachePolicy,
    exportGame,
    type ExportProfile,
    getExportProfileCatalog,
    getExportProfileMetadata,
    resolveExportGameOptions,
} from '../../services/exportGame';
import { type BrowserDesktopExportSmokeRunReport, runBrowserDesktopExportSmoke } from '../../services/exportParityRunner';
import { isTauriRuntime } from '../../services/runtime/runtimeEnvironment';
import { useProjectStore } from '../../store/storeBootstrap';
import { useEditorStore } from '../../store/useEditorStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { styles } from '../../theme/styleHelpers';

export function ExportGameModal() {
    const closeExportGameModal = useEditorStore((state) => state.closeExportGameModal);
    const isOpen = useEditorStore((state) => state.isExportGameModalOpen);
    const markManualSave = useEditorStore((state) => state.markManualSave);
    const uiScale = useEditorStore((state) => state.uiScale);
    const projectPath = useProjectStore((state) => state.projectPath);
    const saveAllDirtyFiles = useProjectStore((state) => state.saveAllDirtyFiles);
    const dialogReference = useRef<HTMLDivElement | null>(null);
    const descriptionId = useId();
    const statusId = useId();
    const titleId = useId();

    const profileCatalog = useMemo(() => getExportProfileCatalog(), []);
    const [profile, setProfile] = useState<ExportProfile>('itch-html5');
    const [base, setBase] = useState('./');
    const [cachePolicy, setCachePolicy] = useState<ExportCachePolicy>('hashed');
    const [outDirectory, setOutDirectory] = useState('');
    const [zipEnabled, setZipEnabled] = useState(true);
    const [zipFile, setZipFile] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | undefined>();
    const activeProfileMetadata = useMemo(() => getExportProfileMetadata(profile), [profile]);
    const plannedProfileMetadata = useMemo(
        () => profileCatalog.filter((entry) => !entry.selectable),
        [profileCatalog],
    );

    const defaultOutDirectory = useMemo(() => {
        return projectPath ? buildDefaultOutputDirectory(projectPath) : 'dist/game';
    }, [projectPath]);
    const defaultZipFilePath = useMemo(() => {
        return projectPath ? defaultZipPath(projectPath) : 'dist/game.zip';
    }, [projectPath]);
    const applyProfileDefaults = useCallback((nextProfile: ExportProfile) => {
        const resolved = resolveExportGameOptions({ profile: nextProfile });
        if (resolved.base !== undefined) setBase(resolved.base);
        if (resolved.cachePolicy !== undefined) setCachePolicy(resolved.cachePolicy);
        if (resolved.zip !== undefined) setZipEnabled(resolved.zip);
    }, []);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setProfile('itch-html5');
        applyProfileDefaults('itch-html5');
        setOutDirectory(defaultOutDirectory);
        setZipFile(defaultZipFilePath);
        setStatusMessage(undefined);
    }, [applyProfileDefaults, defaultOutDirectory, defaultZipFilePath, isOpen]);

    useEffect(() => {
        applyProfileDefaults(profile);
        setZipFile((current) => profile === 'itch-html5' && !current.trim() ? defaultZipFilePath : current);
    }, [applyProfileDefaults, defaultZipFilePath, profile]);

    useEffect(() => {
        if (!isOpen) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !isExporting) {
                closeExportGameModal();
            }
        };

        globalThis.addEventListener('keydown', onKeyDown);
        return () => {
            globalThis.removeEventListener('keydown', onKeyDown);
        };
    }, [closeExportGameModal, isExporting, isOpen]);
    useDialogFocusTrap({ active: isOpen, containerReference: dialogReference });
    const backdropDismissal = useBackdropDismissal(closeExportGameModal, { disabled: isExporting });

    if (!isOpen) {
        return;
    }

    const canExport = !!projectPath && !isExporting;
    const canRunParitySmoke = canExport && isTauriRuntime();

    const getCurrentExportOptions = () => ({
        base: base.trim() || undefined,
        cachePolicy,
        outDir: outDirectory.trim() || undefined,
        profile,
        zip: zipEnabled,
        zipFile: zipEnabled ? (zipFile.trim() || undefined) : undefined,
    });

    const handleExport = async () => {
        if (!projectPath || isExporting) {
            return;
        }

        setIsExporting(true);
        setStatusMessage('Export started. Details will stream to the Console panel.');

        try {
            markManualSave();
            await saveAllDirtyFiles();

            console.info('[Export Game] Running export with options:', {
                ...getCurrentExportOptions(),
                projectPath,
            });

            const result = await exportGame(projectPath, getCurrentExportOptions());
            const stderr = typeof (result as { stderr?: unknown }).stderr === 'string'
                ? (result as { stderr: string }).stderr
                : '';

            if (result.stdout.trim().length > 0) {
                console.info('[Export Game] Build output:\n' + result.stdout.trim());
            }
            if (stderr.trim().length > 0) {
                console.warn('[Export Game] Build warnings:\n' + stderr.trim());
            }

            setStatusMessage('Export finished. Check Console panel for output paths and details.');
        } catch (error) {
            console.error('[Export Game] Export failed:', error);
            setStatusMessage(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsExporting(false);
        }
    };

    const handleParitySmoke = async () => {
        if (!projectPath || isExporting) {
            return;
        }

        setIsExporting(true);
        setStatusMessage('Export parity smoke started. Details will stream to the Console panel.');

        try {
            markManualSave();
            await saveAllDirtyFiles();

            const options = {
                ...getCurrentExportOptions(),
                profile: 'local-preview' as const,
                zip: false,
                zipFile: undefined,
            };
            console.info('[Export Parity Smoke] Running browser/desktop export smoke with options:', {
                ...options,
                projectPath,
            });

            const report = await runBrowserDesktopExportSmoke(projectPath, options);
            logParitySmokeReport(report);
            setStatusMessage(formatParitySmokeStatus(report.comparison.status));
        } catch (error) {
            console.error('[Export Parity Smoke] Export parity smoke failed:', error);
            setStatusMessage(`Export parity smoke failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div
            {...backdropDismissal}
            style={{
                background: 'rgba(0, 0, 0, 0.45)',
                display: 'grid',
                inset: 0,
                placeItems: 'center',
                position: 'fixed',
                zIndex: 5300,
            }}
        >
            <div
                aria-busy={isExporting}
                aria-describedby={`${descriptionId} ${statusId}`}
                aria-labelledby={titleId}
                aria-modal="true"
                onClick={(event) => event.stopPropagation()}
                ref={dialogReference}
                role="dialog"
                style={{
                    background: t.bg.panel,
                    border: `1px solid ${t.border.normal}`,
                    borderRadius: t.radius.lg,
                    boxShadow: t.shadow.popupStrong,
                    color: t.text.primary,
                    display: 'grid',
                    gap: `${10 * uiScale}px`,
                    minWidth: `${560 * uiScale}px`,
                    padding: `${16 * uiScale}px`,
                }}
                tabIndex={-1}
            >
                <div id={titleId} style={{ fontSize: `${15 * uiScale}px`, fontWeight: 700 }}>Export Game</div>
                <div id={descriptionId} style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                    Configure export options without leaving the editor. Output logs are written to the Console panel.
                </div>

                <label style={{ display: 'grid', fontSize: `${12 * uiScale}px`, gap: `${4 * uiScale}px` }}>
                    Export Profile
                    <select
                        disabled={isExporting}
                        onChange={(event) => setProfile(event.target.value as ExportProfile)}
                        style={{ ...styles.input(uiScale), padding: `${6 * uiScale}px ${8 * uiScale}px` }}
                        value={profile}
                    >
                        {profileCatalog.map((entry) => (
                            <option disabled={!entry.selectable} key={entry.id} value={entry.id}>
                                {entry.label}{entry.status === 'planned' ? ' (planned)' : ''}
                            </option>
                        ))}
                    </select>
                </label>
                <div style={profileInfoStyle(uiScale)}>
                    <span style={profileStatusPillStyle(uiScale)}>{activeProfileMetadata.target} | {activeProfileMetadata.status}</span>
                    <span>{activeProfileMetadata.description}</span>
                </div>
                {plannedProfileMetadata.map((entry) => (
                    <div key={entry.id} style={profileInfoStyle(uiScale)}>
                        <span style={profileStatusPillStyle(uiScale)}>{entry.target} | {entry.status}</span>
                        <span>{entry.description}</span>
                    </div>
                ))}

                <label style={{ display: 'grid', fontSize: `${12 * uiScale}px`, gap: `${4 * uiScale}px` }}>
                    Compiled Content Cache
                    <select
                        disabled={isExporting}
                        onChange={(event) => setCachePolicy(event.target.value as ExportCachePolicy)}
                        style={{ ...styles.input(uiScale), padding: `${6 * uiScale}px ${8 * uiScale}px` }}
                        value={cachePolicy}
                    >
                        <option value="hashed">Hashed local files (recommended)</option>
                        <option value="none">No cache manifest</option>
                    </select>
                </label>

                <label style={{ display: 'grid', fontSize: `${12 * uiScale}px`, gap: `${4 * uiScale}px` }}>
                    Build Base URL
                    <input
                        disabled={isExporting || profile === 'itch-html5'}
                        onChange={(event) => setBase(event.target.value)}
                        placeholder="./"
                        style={styles.input(uiScale)}
                        value={base}
                    />
                </label>

                <label style={{ display: 'grid', fontSize: `${12 * uiScale}px`, gap: `${4 * uiScale}px` }}>
                    Output Directory (relative to workspace root or absolute)
                    <input
                        disabled={isExporting}
                        onChange={(event) => setOutDirectory(event.target.value)}
                        placeholder={defaultOutDirectory}
                        style={styles.input(uiScale)}
                        value={outDirectory}
                    />
                </label>

                <label style={{ alignItems: 'center', display: 'flex', fontSize: `${12 * uiScale}px`, gap: `${8 * uiScale}px` }}>
                    <input
                        checked={zipEnabled}
                        disabled={isExporting || profile === 'itch-html5'}
                        onChange={(event) => setZipEnabled(event.target.checked)}
                        type="checkbox"
                    />
                    Create zip archive
                </label>

                <label style={{ display: 'grid', fontSize: `${12 * uiScale}px`, gap: `${4 * uiScale}px`, opacity: zipEnabled ? 1 : 0.55 }}>
                    Zip Output Path
                    <input
                        disabled={!zipEnabled || isExporting}
                        onChange={(event) => setZipFile(event.target.value)}
                        placeholder={defaultZipFilePath}
                        style={styles.input(uiScale)}
                        value={zipFile}
                    />
                </label>

                <div
                    aria-live="polite"
                    id={statusId}
                    role="status"
                    style={{ color: t.text.muted, fontSize: `${12 * uiScale}px`, minHeight: `${16 * uiScale}px` }}
                >
                    {statusMessage ?? (projectPath ? `Project: ${projectPath}` : 'Open a project first to export.')}
                </div>

                <div style={{ display: 'flex', gap: `${8 * uiScale}px`, justifyContent: 'flex-end' }}>
                    <button
                        disabled={isExporting}
                        onClick={closeExportGameModal}
                        style={{ ...styles.buttonBase(uiScale) }}
                        type="button"
                    >
                        Close
                    </button>
                    <button
                        disabled={!canExport}
                        onClick={() => {
                            void handleExport();
                        }}
                        style={{
                            ...styles.buttonBase(uiScale),
                            background: canExport ? t.accent.primary : t.bg.panelAlt,
                            border: 'none',
                            color: canExport ? '#fff' : t.text.muted,
                        }}
                        type="button"
                    >
                        {isExporting ? 'Exporting...' : 'Export'}
                    </button>
                    <button
                        disabled={!canRunParitySmoke}
                        onClick={() => {
                            void handleParitySmoke();
                        }}
                        style={{
                            ...styles.buttonBase(uiScale),
                            background: canRunParitySmoke ? t.accent.primary : t.bg.panelAlt,
                            border: 'none',
                            color: canRunParitySmoke ? '#fff' : t.text.muted,
                        }}
                        type="button"
                    >
                        {isExporting ? 'Running...' : 'Parity Smoke'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function basename(path: string): string {
    return path.split(/[\\/]/).findLast((segment) => segment.length > 0) ?? 'game';
}

function buildDefaultOutputDirectory(projectPath: string): string {
    return `dist/${basename(projectPath)}`;
}

function defaultZipPath(projectPath: string): string {
    return `${buildDefaultOutputDirectory(projectPath)}.zip`;
}

function formatParitySmokeStatus(status: BrowserDesktopExportSmokeRunReport['comparison']['status']): string {
    switch (status) {
        case 'blocked': {
            return 'Export parity smoke blocked. Check Console panel for missing artifact details.';
        }
        case 'matched': {
            return 'Export parity smoke matched browser and desktop artifacts.';
        }
        case 'mismatched': {
            return 'Export parity smoke found artifact differences. Check Console panel for details.';
        }
    }
}

function logParitySmokeReport(report: BrowserDesktopExportSmokeRunReport): void {
    const { comparison } = report;

    if (comparison.browserStdout.trim()) {
        console.info('[Export Parity Smoke] Browser output:\n' + comparison.browserStdout.trim());
    }
    if (comparison.desktopStdout.trim()) {
        console.info('[Export Parity Smoke] Desktop output:\n' + comparison.desktopStdout.trim());
    }

    if (comparison.status === 'blocked') {
        console.warn('[Export Parity Smoke] Blocked:', comparison.reasons);
        return;
    }

    const { summary } = comparison.artifactComparison;
    console.info('[Export Parity Smoke] Artifact comparison:', {
        matched: summary.matched,
        mismatched: summary.mismatched,
        missing: summary.missing,
        status: comparison.status,
    });

    for (const check of comparison.artifactComparison.checks) {
        console.info(`[Export Parity Smoke] ${check.id}: ${check.status}`, {
            browser: check.browser,
            desktop: check.desktop,
            missingInBrowser: check.missingInBrowser,
            missingInDesktop: check.missingInDesktop,
            note: check.note,
        });
    }
}

function profileInfoStyle(uiScale: number) {
    return {
        alignItems: 'center',
        color: t.text.muted,
        display: 'flex',
        fontSize: `${11 * uiScale}px`,
        gap: `${6 * uiScale}px`,
        minWidth: 0,
    };
}

function profileStatusPillStyle(uiScale: number) {
    return {
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.sm,
        color: t.text.normal,
        flexShrink: 0,
        padding: `${2 * uiScale}px ${5 * uiScale}px`,
        textTransform: 'capitalize' as const,
    };
}
