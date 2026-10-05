import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import type { BrowserFsGlobal } from '../../services/fs/browserFsAdapter';

import { useBackdropDismissal } from '../../hooks/useBackdropDismissal';
import { useDialogFocusTrap } from '../../hooks/useDialogFocusTrap';
import { pickBrowserFolderExportTarget } from '../../services/browserFolderExport';
import {
    type ExportCachePolicy,
    exportGame,
    type ExportProfile,
    getExportProfileCatalog,
    getExportProfileMetadata,
    resolveExportGameOptions,
} from '../../services/exportGame';
import { saveProjectBeforeExport } from '../../services/exportPreflight';
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
    const dialogReference = useRef<HTMLDivElement | null>(null);
    const descriptionId = useId();
    const statusId = useId();
    const titleId = useId();

    const isNativeEditor = isTauriRuntime();
    const profileCatalog = useMemo(() => getExportProfileCatalog().filter(
        (entry) => entry.selectable && (entry.target !== 'desktop' || isNativeEditor),
    ), [isNativeEditor]);
    const [profile, setProfile] = useState<ExportProfile>('itch-html5');
    const [base, setBase] = useState('./');
    const [cachePolicy, setCachePolicy] = useState<ExportCachePolicy>('hashed');
    const [outDirectory, setOutDirectory] = useState('');
    const [zipEnabled, setZipEnabled] = useState(true);
    const [zipFile, setZipFile] = useState('');
    const [browserOutput, setBrowserOutput] = useState<'folder' | 'zip'>('zip');
    const [browserFolderName, setBrowserFolderName] = useState('game-export');
    const [isExporting, setIsExporting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | undefined>();
    const activeProfileMetadata = useMemo(() => getExportProfileMetadata(profile), [profile]);
    const defaultOutDirectory = useMemo(() => {
        return projectPath ? buildDefaultOutputDirectory(projectPath) : 'dist/game';
    }, [projectPath]);
    const defaultZipFilePath = useMemo(() => {
        return isNativeEditor
            ? (projectPath ? defaultZipPath(projectPath) : 'dist/game.zip')
            : `${projectPath ? basename(projectPath) : 'game'}.zip`;
    }, [isNativeEditor, projectPath]);
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
        setBrowserOutput('zip');
        setBrowserFolderName(`${projectPath ? basename(projectPath) : 'game'}-export`);
        setStatusMessage(undefined);
    }, [applyProfileDefaults, defaultOutDirectory, defaultZipFilePath, isOpen, projectPath]);

    useEffect(() => {
        applyProfileDefaults(profile);
        setOutDirectory((current) => {
            if (profile === 'desktop-tauri' && current === defaultOutDirectory) return `${defaultOutDirectory}-desktop`;
            if (profile !== 'desktop-tauri' && current === `${defaultOutDirectory}-desktop`) return defaultOutDirectory;
            return current;
        });
        setZipFile((current) => profile === 'itch-html5' && !current.trim() ? defaultZipFilePath : current);
    }, [applyProfileDefaults, defaultOutDirectory, defaultZipFilePath, profile]);

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
    const isDesktopPackage = profile === 'desktop-tauri';

    const getCurrentExportOptions = () => ({
        base: base.trim() || undefined,
        cachePolicy,
        outDir: isNativeEditor ? (outDirectory.trim() || undefined) : undefined,
        profile,
        zip: isNativeEditor ? zipEnabled : true,
        zipFile: !isNativeEditor || zipEnabled ? (zipFile.trim() || undefined) : undefined,
    });

    const handleExport = async () => {
        if (!projectPath || isExporting) {
            return;
        }

        const projectGeneration = useProjectStore.getState().projectGeneration;
        setIsExporting(true);
        setStatusMessage(isDesktopPackage ? 'Packaging desktop game...' : 'Exporting game...');

        try {
            const browserFolder = !isNativeEditor && browserOutput === 'folder'
                ? await pickBrowserFolderExportTarget(browserFolderName)
                : undefined;
            if (!isNativeEditor && browserOutput === 'folder' && !browserFolder) {
                setStatusMessage('Export cancelled.');
                return;
            }
            const currentProject = useProjectStore.getState();
            if (currentProject.projectPath !== projectPath || currentProject.projectGeneration !== projectGeneration) {
                throw new Error('The project changed. Start export again.');
            }
            markManualSave();
            await saveProjectBeforeExport(projectPath, useProjectStore.getState);

            console.info('[Export Game] Running export with options:', {
                ...getCurrentExportOptions(),
                projectPath,
            });

            const result = await exportGame(projectPath, { ...getCurrentExportOptions(), browserFolder });
            const stderr = typeof (result as { stderr?: unknown }).stderr === 'string'
                ? (result as { stderr: string }).stderr
                : '';

            if (result.stdout.trim().length > 0) {
                console.info('[Export Game] Build output:\n' + result.stdout.trim());
            }
            if (stderr.trim().length > 0) {
                console.warn('[Export Game] Build warnings:\n' + stderr.trim());
            }

            setStatusMessage(isNativeEditor || browserFolder
                ? `Exported to ${result.executablePath ?? result.outDirectory ?? outDirectory}.`
                : 'Export complete. Your browser download is ready.');
        } catch (error) {
            console.error('[Export Game] Export failed:', error);
            setStatusMessage(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
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
                    boxSizing: 'border-box',
                    color: t.text.primary,
                    display: 'grid',
                    gap: `${10 * uiScale}px`,
                    maxHeight: `min(92vh, ${720 * uiScale}px)`,
                    maxWidth: `min(94vw, ${620 * uiScale}px)`,
                    overflowWrap: 'anywhere',
                    overflowY: 'auto',
                    padding: `${16 * uiScale}px`,
                    width: `min(94vw, ${560 * uiScale}px)`,
                }}
                tabIndex={-1}
            >
                <div id={titleId} style={{ fontSize: `${15 * uiScale}px`, fontWeight: 700 }}>Export Game</div>
                <div id={descriptionId} style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                    {isNativeEditor
                        ? 'Choose where to share your game and where to save the export.'
                        : (browserOutput === 'zip' ? 'Choose where to share your game. The export downloads as a ZIP archive.' : 'Choose a parent folder when you export. Your game is saved in a new subfolder.')}
                </div>

                <label style={{ display: 'grid', fontSize: `${12 * uiScale}px`, gap: `${4 * uiScale}px` }}>
                    Export for
                    <select
                        disabled={isExporting}
                        onChange={(event) => setProfile(event.target.value as ExportProfile)}
                        style={{ ...styles.input(uiScale), padding: `${6 * uiScale}px ${8 * uiScale}px` }}
                        value={profile}
                    >
                        {profileCatalog.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                                {entry.label}
                            </option>
                        ))}
                    </select>
                </label>
                <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                    {!isNativeEditor && browserOutput === 'folder' && profile === 'itch-html5' ? 'Playable game files. Create a ZIP before uploading to itch.io.' : activeProfileMetadata.description}
                </div>
                {!isNativeEditor && (
                    <label style={{ display: 'grid', fontSize: `${12 * uiScale}px`, gap: `${4 * uiScale}px` }}>
                        Save export as
                        <select aria-label="Save export as" disabled={isExporting} onChange={event => setBrowserOutput(event.target.value as 'folder' | 'zip')} style={styles.input(uiScale)} value={browserOutput}>
                            <option value="zip">ZIP download</option>
                            <option disabled={typeof (globalThis as BrowserFsGlobal).showDirectoryPicker !== 'function'} value="folder">Folder</option>
                        </select>
                    </label>
                )}
                {!isNativeEditor && browserOutput === 'folder' && (
                    <label style={{ display: 'grid', fontSize: `${12 * uiScale}px`, gap: `${4 * uiScale}px` }}>
                        Export folder name
                        <input aria-label="Export folder name" disabled={isExporting} onChange={event => setBrowserFolderName(event.target.value)} style={styles.input(uiScale)} value={browserFolderName} />
                        <span style={{ color: t.text.muted }}>Use a new folder outside your source project. Existing exports are kept.</span>
                    </label>
                )}

                {isNativeEditor && (
                    <label style={{ display: 'grid', fontSize: `${12 * uiScale}px`, gap: `${4 * uiScale}px` }}>
                        Output folder
                        <input
                            disabled={isExporting}
                            onChange={(event) => setOutDirectory(event.target.value)}
                            placeholder={defaultOutDirectory}
                            style={styles.input(uiScale)}
                            value={outDirectory}
                        />
                        <span style={{ color: t.text.muted }}>
                            Use a new folder. Relative paths start from the project’s parent folder.
                        </span>
                    </label>
                )}

                {isNativeEditor && !isDesktopPackage && (
                    <label style={{ alignItems: 'center', display: 'flex', fontSize: `${12 * uiScale}px`, gap: `${8 * uiScale}px` }}>
                        <input
                            checked={zipEnabled}
                            disabled={isExporting || profile === 'itch-html5'}
                            onChange={(event) => setZipEnabled(event.target.checked)}
                            type="checkbox"
                        />
                        Create ZIP archive
                    </label>
                )}

                {(isNativeEditor ? zipEnabled : browserOutput === 'zip') && !isDesktopPackage && (
                    <label style={{ display: 'grid', fontSize: `${12 * uiScale}px`, gap: `${4 * uiScale}px` }}>
                        {isNativeEditor ? 'ZIP file path' : 'Download file name'}
                        <input
                            disabled={isExporting}
                            onChange={(event) => setZipFile(event.target.value)}
                            placeholder={defaultZipFilePath}
                            style={styles.input(uiScale)}
                            value={zipFile}
                        />
                        {isNativeEditor && <span style={{ color: t.text.muted }}>Use a new file. Existing exports are kept.</span>}
                    </label>
                )}

                {!isDesktopPackage && (
                    <details style={{ fontSize: `${12 * uiScale}px` }}>
                        <summary style={{ color: t.text.muted, cursor: 'pointer' }}>Advanced</summary>
                        <div style={{ display: 'grid', gap: `${10 * uiScale}px`, paddingTop: `${10 * uiScale}px` }}>
                            <label style={{ display: 'grid', gap: `${4 * uiScale}px` }}>
                                Compiled content cache
                                <select
                                    disabled={isExporting}
                                    onChange={(event) => setCachePolicy(event.target.value as ExportCachePolicy)}
                                    style={styles.input(uiScale)}
                                    value={cachePolicy}
                                >
                                    <option value="hashed">Cache unchanged files</option>
                                    <option value="none">No cache</option>
                                </select>
                            </label>
                            <label style={{ display: 'grid', gap: `${4 * uiScale}px` }}>
                                Base URL
                                <input
                                    disabled={isExporting || profile === 'itch-html5'}
                                    onChange={(event) => setBase(event.target.value)}
                                    placeholder="./"
                                    style={styles.input(uiScale)}
                                    value={base}
                                />
                            </label>
                        </div>
                    </details>
                )}

                <div
                    aria-live="polite"
                    id={statusId}
                    role="status"
                    style={{ color: t.text.muted, fontSize: `${12 * uiScale}px`, minHeight: `${16 * uiScale}px` }}
                >
                    {statusMessage ?? (projectPath ? '' : 'Open a project first to export.')}
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
