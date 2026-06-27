import { FolderOpen, Languages, MonitorDot, Pause, Play, Save, SkipForward, Square, Volume2, VolumeX, ZoomIn, ZoomOut } from 'lucide-react';

import { fsPickProjectManifest } from '../../services/fs';
import { SOURCE_PREVIEW_LOCALE } from '../../services/localizationPreview';
import { openProjectEntry } from '../../services/openProjectEntry';
import { isTauriRuntime } from '../../services/runtime/runtimeEnvironment';
import { executeOpenProjectInCurrentWindow } from '../../store/actions/projectOpenActions';
import { useProjectStore } from '../../store/storeBootstrap';
import { useEditorStore } from '../../store/useEditorStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { openInitialProjectEntry as openInitialProjectEntryModel } from '../tools/commandPaletteModel';
import { ThemeMenu } from './menus/ThemeMenu';

export function Toolbar() {
    const { activeFile, locales, manifest, saveActiveFileFromCurrentScript } = useProjectStore();
    const isMuted = useSettingsStore((state) => state.isMuted);
    const setIsMuted = useSettingsStore((state) => state.setIsMuted);
    const setThemeKey = useSettingsStore((state) => state.setThemeKey);
    const customThemes = useSettingsStore((state) => state.customThemes);
    const themeKey = useSettingsStore((state) => state.themeKey);
    const {
        addRecentProject,
        isPlaybackPaused,
        playTrigger,
        resetDockLayout,
        setUiScale,
        stopTrigger,
        triggerPause,
        triggerPlay,
        triggerResume,
        triggerStep,
        triggerStop,
        uiScale,
    } = useEditorStore();
    const previewLocale = useEditorStore((state) => state.previewLocale);
    const setPreviewLocale = useEditorStore((state) => state.setPreviewLocale);

    const handleOpenInitialProjectEntry = async () => {
        const { expandToPath, manifest, projectPath } = useProjectStore.getState();
        await openInitialProjectEntryModel({
            expandToPath,
            manifest,
            openProjectEntry,
            projectPath,
        });
    };

    const handleOpenProject = async () => {
        try {
            const selectedProject = await fsPickProjectManifest();

            if (selectedProject) {
                const opened = await executeOpenProjectInCurrentWindow(selectedProject.manifestPath);
                if (opened.status === 'cancelled') return;
                if (isTauriRuntime()) addRecentProject(selectedProject.manifestPath);
                if (opened.status === 'opened-current') await handleOpenInitialProjectEntry();
            }
        } catch (error) {
            console.error('Failed to open project dialog:', error);
        }
    };

    const handleSave = async () => {
        if (!activeFile) return;
        await saveActiveFileFromCurrentScript();
    };

    const pad = `${6 * uiScale}px`;
    const iconSize = 16 * uiScale;
    const isRunning = playTrigger > stopTrigger;
    const toggleMute = () => setIsMuted(!isMuted);
    const localeIds = Object.keys(locales).toSorted((left, right) => left.localeCompare(right));
    const manifestDefaultLocale = manifest?.localization?.defaultLocale;
    const selectedPreviewLocale = previewLocale
        ?? (manifestDefaultLocale && localeIds.includes(manifestDefaultLocale) ? manifestDefaultLocale : SOURCE_PREVIEW_LOCALE);

    return (
        <div
            style={{
                alignItems: 'center',
                backgroundColor: t.bg.panelAlt,
                borderBottom: `1px solid ${t.border.input}`,
                boxSizing: 'border-box',
                display: 'flex',
                gap: `${6 * uiScale}px`,
                height: '100%',
                overflow: 'hidden',
                padding: `0 ${10 * uiScale}px`,
                width: '100%',
            }}
        >
            <strong style={{ color: t.text.primary, fontSize: '0.95em', marginRight: `${8 * uiScale}px`, whiteSpace: 'nowrap' }}>
                Zerith Editor
            </strong>

            <button className="toolbar-btn" onClick={() => { void handleOpenProject(); }} style={{ padding: pad }} title="Open Project">
                <FolderOpen size={iconSize} />
            </button>
            <button className="toolbar-btn" onClick={() => { void handleSave(); }} style={{ padding: pad }} title="Save Active File">
                <Save size={iconSize} />
            </button>

            <button className="toolbar-btn" onClick={resetDockLayout} style={{ padding: pad }} title="Reset UI Layout">
                <MonitorDot size={iconSize} />
            </button>


            <div style={{ alignItems: 'center', display: 'flex', marginLeft: '4px' }}>
                <ThemeMenu customThemes={customThemes} onSelect={setThemeKey} selectedKey={themeKey} uiScale={uiScale} />
            </div>

            <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
                <label
                    style={{
                        alignItems: 'center',
                        display: 'inline-flex',
                        gap: `${4 * uiScale}px`,
                        marginRight: `${4 * uiScale}px`,
                    }}
                    title="Preview locale"
                >
                    <Languages color={t.text.muted} size={iconSize} />
                    <select
                        disabled={localeIds.length === 0}
                        onChange={(event) => setPreviewLocale(event.currentTarget.value || undefined)}
                        style={{
                            background: t.bg.input,
                            border: `1px solid ${t.border.input}`,
                            borderRadius: t.radius.sm,
                            color: t.text.primary,
                            fontSize: `${12 * uiScale}px`,
                            maxWidth: `${120 * uiScale}px`,
                            minWidth: `${84 * uiScale}px`,
                            outline: 'none',
                            padding: `${5 * uiScale}px ${6 * uiScale}px`,
                        }}
                        value={selectedPreviewLocale}
                    >
                        <option value={SOURCE_PREVIEW_LOCALE}>Source text</option>
                        {localeIds.map((locale) => (
                            <option key={locale} value={locale}>{locale}</option>
                        ))}
                    </select>
                </label>
                <button className="toolbar-btn" onClick={toggleMute} style={{ padding: pad }} title={isMuted ? 'Unmute Audio' : 'Mute Audio'}>
                    {isMuted ? <VolumeX color={t.accent.red} size={iconSize} /> : <Volume2 size={iconSize} />}
                </button>
                <button
                    className="toolbar-btn"
                    disabled={!isRunning || isPlaybackPaused}
                    onClick={triggerPause}
                    style={{ padding: pad }}
                    title="Pause Preview"
                >
                    <Pause size={iconSize} />
                </button>
                <button
                    className="toolbar-btn"
                    disabled={!isRunning || !isPlaybackPaused}
                    onClick={triggerResume}
                    style={{ padding: pad }}
                    title="Resume Preview"
                >
                    <Play size={iconSize} />
                </button>
                <button
                    className="toolbar-btn"
                    disabled={!isRunning || !isPlaybackPaused}
                    onClick={triggerStep}
                    style={{ padding: pad }}
                    title="Step Over"
                >
                    <SkipForward size={iconSize} />
                </button>
                <button className="toolbar-btn danger" onClick={triggerStop} style={{ padding: pad }} title="Stop Preview">
                    <Square fill="currentColor" size={iconSize} />
                </button>
                <button className="toolbar-btn primary" onClick={triggerPlay} style={{ padding: pad }} title="Play Preview">
                    <Play fill="currentColor" size={iconSize} />
                </button>
            </div>

            <div
                style={{
                    alignItems: 'center',
                    borderLeft: `1px solid ${t.border.subtle}`,
                    display: 'flex',
                    gap: '2px',
                    marginLeft: `${10 * uiScale}px`,
                    paddingLeft: `${10 * uiScale}px`,
                }}
            >
                <button className="toolbar-btn" onClick={() => setUiScale(Math.max(0.8, uiScale - 0.1))} style={{ padding: pad }} title="Zoom Out UI">
                    <ZoomOut size={iconSize} />
                </button>
                <span style={{ color: t.text.normal, fontSize: '0.85em', minWidth: `${34 * uiScale}px`, textAlign: 'center' }}>
                    {Math.round(uiScale * 100)}%
                </span>
                <button className="toolbar-btn" onClick={() => setUiScale(Math.min(1.5, uiScale + 0.1))} style={{ padding: pad }} title="Zoom In UI">
                    <ZoomIn size={iconSize} />
                </button>
            </div>
        </div>
    );
}
