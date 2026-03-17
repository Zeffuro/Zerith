import { useEffect, useMemo, useState } from 'react';

import { exportGame } from '../../services/exportGame';
import { useProjectStore } from '../../store/storeBootstrap';
import { useEditorStore } from '../../store/useEditorStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { styles } from '../../theme/styleHelpers';

type ExportTarget = 'itch' | 'web';

export function ExportGameModal() {
    const closeExportGameModal = useEditorStore((state) => state.closeExportGameModal);
    const isOpen = useEditorStore((state) => state.isExportGameModalOpen);
    const markManualSave = useEditorStore((state) => state.markManualSave);
    const uiScale = useEditorStore((state) => state.uiScale);
    const projectPath = useProjectStore((state) => state.projectPath);
    const saveAllDirtyFiles = useProjectStore((state) => state.saveAllDirtyFiles);

    const [target, setTarget] = useState<ExportTarget>('itch');
    const [base, setBase] = useState('./');
    const [outDirectory, setOutDirectory] = useState('');
    const [zipEnabled, setZipEnabled] = useState(true);
    const [zipFile, setZipFile] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | undefined>();

    const defaultOutDirectory = useMemo(() => {
        return projectPath ? buildDefaultOutputDirectory(projectPath) : 'dist/game';
    }, [projectPath]);
    const defaultZipFilePath = useMemo(() => {
        return projectPath ? defaultZipPath(projectPath) : 'dist/game.zip';
    }, [projectPath]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setTarget('itch');
        setBase('./');
        setOutDirectory(defaultOutDirectory);
        setZipEnabled(true);
        setZipFile(defaultZipFilePath);
        setStatusMessage(undefined);
    }, [defaultOutDirectory, defaultZipFilePath, isOpen]);

    useEffect(() => {
        if (target === 'itch') {
            setBase('./');
            setZipEnabled(true);
            if (!zipFile.trim()) {
                setZipFile(defaultZipFilePath);
            }
        }
    }, [defaultZipFilePath, target, zipFile]);

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

    if (!isOpen) {
        return;
    }

    const canExport = !!projectPath && !isExporting;

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
                base,
                outDirectory,
                projectPath,
                target,
                zip: zipEnabled,
                zipFile,
            });

            const result = await exportGame(projectPath, {
                base: base.trim() || undefined,
                outDir: outDirectory.trim() || undefined,
                zip: zipEnabled,
                zipFile: zipEnabled ? (zipFile.trim() || undefined) : undefined,
            });
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

    return (
        <div
            onClick={() => {
                if (!isExporting) {
                    closeExportGameModal();
                }
            }}
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
                onClick={(event) => event.stopPropagation()}
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
            >
                <div style={{ fontSize: `${15 * uiScale}px`, fontWeight: 700 }}>Export Game</div>
                <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                    Configure export options without leaving the editor. Output logs are written to the Console panel.
                </div>

                <label style={{ display: 'grid', fontSize: `${12 * uiScale}px`, gap: `${4 * uiScale}px` }}>
                    Target
                    <select
                        disabled={isExporting}
                        onChange={(event) => setTarget(event.target.value as ExportTarget)}
                        style={{ ...styles.input(uiScale), padding: `${6 * uiScale}px ${8 * uiScale}px` }}
                        value={target}
                    >
                        <option value="itch">Itch.io HTML5 (zip + base ./)</option>
                        <option value="web">Generic web host</option>
                    </select>
                </label>

                <label style={{ display: 'grid', fontSize: `${12 * uiScale}px`, gap: `${4 * uiScale}px` }}>
                    Build Base URL
                    <input
                        disabled={isExporting || target === 'itch'}
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
                        disabled={isExporting || target === 'itch'}
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

                <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px`, minHeight: `${16 * uiScale}px` }}>
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

