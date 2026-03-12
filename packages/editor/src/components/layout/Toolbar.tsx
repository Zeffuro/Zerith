import { open } from '@tauri-apps/plugin-dialog';
import { FolderOpen, MonitorDot, Pause, Play, Save, SkipForward, Square, Star, Volume2, VolumeX, ZoomIn, ZoomOut } from 'lucide-react';
import { useState } from 'react';

import { openProjectEntry } from '../../services/openProjectEntry';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { QuickCommandsMenu } from './menus/QuickCommandsMenu';
import { ThemeMenu } from './menus/ThemeMenu';

export function Toolbar() {
    const { activeFile, openProjectFromManifest, saveActiveFileFromCurrentScript } = useProjectStore();
    const {
        addRecentProject,
        isMuted,
        isPlaybackPaused,
        moveQuickCommandType,
        playTrigger,
        quickCommandTypes,
        resetDockLayout,
        setThemeKey,
        setUiScale,
        stopTrigger,
        themeKey,
        toggleMute,
        toggleQuickCommandType,
        triggerPause,
        triggerPlay,
        triggerResume,
        triggerStep,
        triggerStop,
        uiScale,
    } = useEditorStore();

    const [quickOpen, setQuickOpen] = useState(false);

    const handleOpenProject = async () => {
        try {
            const selectedFile = await open({
                directory: false,
                filters: [{ extensions: ['json'], name: 'Game Manifest' }],
                multiple: false,
                title: 'Select game.json'
            });

            if (selectedFile) {
                await openProjectFromManifest(selectedFile);
                addRecentProject(selectedFile);
                await openInitialProjectEntry();
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

            <button className="toolbar-btn" onClick={() => setQuickOpen(v => !v)} style={{ padding: pad }} title="Quick Buttons Configuration">
                <Star size={iconSize} />
            </button>

            <button className="toolbar-btn" onClick={resetDockLayout} style={{ padding: pad }} title="Reset UI Layout">
                <MonitorDot size={iconSize} />
            </button>

            <QuickCommandsMenu
                moveQuickCommandType={moveQuickCommandType}
                onClose={() => setQuickOpen(false)}
                open={quickOpen}
                quickCommandTypes={quickCommandTypes}
                toggleQuickCommandType={toggleQuickCommandType}
                uiScale={uiScale}
            />

            <div style={{ alignItems: 'center', display: 'flex', marginLeft: '4px' }}>
                <ThemeMenu onSelect={setThemeKey} selectedKey={themeKey} uiScale={uiScale} />
            </div>

            <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
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

function basename(path: string): string {
    return path.split(/[\\/]/).pop() || path;
}

async function openInitialProjectEntry(): Promise<void> {
    const { expandToPath, manifest, projectPath } = useProjectStore.getState();
    if (!projectPath) return;

    const startSceneName = manifest?.startScene;
    const sceneEntry = startSceneName ? manifest?.scenes?.[startSceneName] : undefined;
    if (typeof sceneEntry === 'string') {
        const scenePath = resolveProjectPath(projectPath, sceneEntry);
        expandToPath(scenePath);
        await openProjectEntry(scenePath, basename(scenePath));
        return;
    }

    const gameManifestPath = `${projectPath}/game.json`;
    expandToPath(gameManifestPath);
    await openProjectEntry(gameManifestPath, 'game.json');
}


function resolveProjectPath(projectPath: string, targetPath: string): string {
    if (targetPath.startsWith('/') || targetPath.startsWith('\\')) {
        return `${projectPath}${targetPath}`;
    }
    return `${projectPath}/${targetPath}`;
}
