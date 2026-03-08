import { Play, Square, FolderOpen, Save, ZoomIn, ZoomOut, Volume2, VolumeX, Star, MonitorDot } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useProjectStore } from '../../store/useProjectStore';
import { useEditorStore } from '../../store/useEditorStore';
import { useState } from 'react';
import { QuickCommandsMenu } from './menus/QuickCommandsMenu';
import { ThemeMenu } from './menus/ThemeMenu';
import { editorTheme as t } from '../../theme/editorTheme';

export function Toolbar() {
    const { activeFile, saveActiveFileFromCurrentScript, openProjectFromManifest } = useProjectStore();
    const {
        uiScale, setUiScale, isMuted, toggleMute, triggerPlay, triggerStop,
        quickCommandTypes, toggleQuickCommandType, moveQuickCommandType,
        themeKey, setThemeKey, resetDockLayout
    } = useEditorStore();

    const [quickOpen, setQuickOpen] = useState(false);

    const handleOpenProject = async () => {
        try {
            const selectedFile = await open({
                multiple: false,
                directory: false,
                filters: [{ name: 'Game Manifest', extensions: ['json'] }],
                title: 'Select game.json'
            });

            if (selectedFile) {
                await openProjectFromManifest(selectedFile);
            }
        } catch (err) {
            console.error('Failed to open project dialog:', err);
        }
    };

    const handleSave = async () => {
        if (!activeFile) return;
        await saveActiveFileFromCurrentScript();
    };

    const pad = `${6 * uiScale}px`;
    const iconSize = 16 * uiScale;

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                backgroundColor: t.bg.panelAlt,
                display: 'flex',
                alignItems: 'center',
                padding: `0 ${10 * uiScale}px`,
                borderBottom: `1px solid ${t.border.input}`,
                gap: `${6 * uiScale}px`,
                boxSizing: 'border-box',
                overflow: 'hidden',
            }}
        >
            <strong style={{ color: t.text.primary, marginRight: `${8 * uiScale}px`, fontSize: '0.95em', whiteSpace: 'nowrap' }}>
                Zerith Editor
            </strong>

            <button className="toolbar-btn" onClick={handleOpenProject} style={{ padding: pad }} title="Open Project">
                <FolderOpen size={iconSize} />
            </button>
            <button className="toolbar-btn" onClick={handleSave} style={{ padding: pad }} title="Save Active File">
                <Save size={iconSize} />
            </button>

            <button className="toolbar-btn" onClick={() => setQuickOpen(v => !v)} style={{ padding: pad }} title="Quick Buttons Configuration">
                <Star size={iconSize} />
            </button>

            <button className="toolbar-btn" onClick={resetDockLayout} style={{ padding: pad }} title="Reset UI Layout">
                <MonitorDot size={iconSize} />
            </button>

            <QuickCommandsMenu
                uiScale={uiScale}
                open={quickOpen}
                onClose={() => setQuickOpen(false)}
                quickCommandTypes={quickCommandTypes}
                toggleQuickCommandType={toggleQuickCommandType}
                moveQuickCommandType={moveQuickCommandType}
            />

            <div style={{ marginLeft: '4px', display: 'flex', alignItems: 'center' }}>
                <ThemeMenu uiScale={uiScale} selectedKey={themeKey} onSelect={setThemeKey} />
            </div>

            <div style={{ display: 'flex', marginLeft: 'auto', gap: '4px' }}>
                <button className="toolbar-btn" onClick={toggleMute} style={{ padding: pad }} title={isMuted ? 'Unmute Audio' : 'Mute Audio'}>
                    {isMuted ? <VolumeX size={iconSize} color={t.accent.red} /> : <Volume2 size={iconSize} />}
                </button>
                <button className="toolbar-btn danger" onClick={triggerStop} style={{ padding: pad }} title="Stop Preview">
                    <Square size={iconSize} fill="currentColor" />
                </button>
                <button className="toolbar-btn primary" onClick={triggerPlay} style={{ padding: pad }} title="Play Preview">
                    <Play size={iconSize} fill="currentColor" />
                </button>
            </div>

            <div
                style={{
                    marginLeft: `${10 * uiScale}px`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    borderLeft: `1px solid ${t.border.subtle}`,
                    paddingLeft: `${10 * uiScale}px`,
                }}
            >
                <button className="toolbar-btn" onClick={() => setUiScale(Math.max(0.8, uiScale - 0.1))} style={{ padding: pad }} title="Zoom Out UI">
                    <ZoomOut size={iconSize} />
                </button>
                <span style={{ fontSize: '0.85em', color: t.text.normal, minWidth: `${34 * uiScale}px`, textAlign: 'center' }}>
                    {Math.round(uiScale * 100)}%
                </span>
                <button className="toolbar-btn" onClick={() => setUiScale(Math.min(1.5, uiScale + 0.1))} style={{ padding: pad }} title="Zoom In UI">
                    <ZoomIn size={iconSize} />
                </button>
            </div>
        </div>
    );
}