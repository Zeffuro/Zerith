import { Play, Square, FolderOpen, Save, ZoomIn, ZoomOut, Volume2, VolumeX, Star } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { useProjectStore } from '../../store/useProjectStore';
import { useEditorStore } from '../../store/useEditorStore';
import { useScriptStore } from '../../store/useScriptStore';
import { useState } from 'react';
import { QuickCommandsMenu } from './QuickCommandsMenu';
import { ThemeMenu } from './ThemeMenu';
import { editorTheme as t } from '../../theme/editorTheme';
import { styles } from '../../theme/styleHelpers';

export function Toolbar() {
    const { setProject, loadManifest, activeFile } = useProjectStore();
    const {
        uiScale, setUiScale, isMuted, toggleMute, triggerPlay, triggerStop,
        quickCommandTypes, toggleQuickCommandType, moveQuickCommandType,
        themeKey, setThemeKey
    } = useEditorStore();
    const rootScript = useScriptStore(state => state.rootScript);

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
                const separator = selectedFile.includes('\\') ? '\\' : '/';
                const pathParts = selectedFile.split(separator);
                pathParts.pop();
                const projectRoot = pathParts.join(separator);

                const entries = await readDir(projectRoot);
                entries.sort((a, b) => {
                    if (a.isDirectory && !b.isDirectory) return -1;
                    if (!a.isDirectory && b.isDirectory) return 1;
                    return a.name.localeCompare(b.name);
                });
                setProject(projectRoot, entries);
                await loadManifest();
            }
        } catch (err) {
            console.error("Failed to open project:", err);
        }
    };

    const { activeMacroName } = useProjectStore();

    const handleSave = async () => {
        if (!activeFile) return;

        try {
            if (activeMacroName) {
                const raw = await readTextFile(activeFile);
                const obj = JSON.parse(raw);
                obj[activeMacroName] = rootScript;
                await writeTextFile(activeFile, JSON.stringify(obj, null, 4));
            } else {
                await writeTextFile(activeFile, JSON.stringify(rootScript, null, 4));
            }
        } catch (err) {
            console.error("Failed to save:", err);
        }
    };

    const iconBtnStyle = styles.iconButton(uiScale);
    const buttonStyle = styles.buttonBase(uiScale);

    return (
        <div style={{ height: `${40 * uiScale}px`, backgroundColor: t.bg.panelAlt, display: 'flex', alignItems: 'center', padding: `0 ${16 * uiScale}px`, borderBottom: `1px solid ${t.border.input}`, position: 'relative' }}>
            <strong style={{ color: t.text.primary, marginRight: `${20 * uiScale}px`, fontSize: '1.1em' }}>Zerith Editor</strong>

            <button onClick={handleOpenProject} style={buttonStyle}>
                <FolderOpen size={14 * uiScale} /> Open
            </button>
            <button onClick={handleSave} style={{ ...buttonStyle, marginLeft: '8px' }}>
                <Save size={14 * uiScale} /> Save
            </button>

            <button onClick={() => setQuickOpen(v => !v)} style={{ ...buttonStyle, marginLeft: '8px' }}>
                <Star size={14 * uiScale} /> Quick Buttons
            </button>

            <QuickCommandsMenu
                uiScale={uiScale}
                open={quickOpen}
                onClose={() => setQuickOpen(false)}
                quickCommandTypes={quickCommandTypes}
                toggleQuickCommandType={toggleQuickCommandType}
                moveQuickCommandType={moveQuickCommandType}
            />

            <div style={{ marginLeft: '8px', display: 'flex', alignItems: 'center' }}>
                <ThemeMenu uiScale={uiScale} selectedKey={themeKey} onSelect={setThemeKey} />
            </div>

            <div style={{ display: 'flex', marginLeft: 'auto', gap: '8px' }}>
                <button onClick={toggleMute} style={{ ...buttonStyle, border: 'none' }} title={isMuted ? "Unmute" : "Mute"}>
                    {isMuted ? <VolumeX size={16 * uiScale} color={t.accent.red} /> : <Volume2 size={16 * uiScale} />}
                </button>
                <button onClick={triggerStop} style={{ ...buttonStyle, background: t.bg.danger, border: 'none', color: t.text.primary }}>
                    <Square size={12 * uiScale} fill="currentColor" /> Stop
                </button>
                <button onClick={triggerPlay} style={{ ...buttonStyle, background: t.accent.primary, border: 'none', color: t.text.primary }}>
                    <Play size={14 * uiScale} /> Play
                </button>
            </div>

            <div style={{ marginLeft: `${16 * uiScale}px`, display: 'flex', alignItems: 'center', gap: '4px', borderLeft: `1px solid #444`, paddingLeft: `${16 * uiScale}px` }}>
                <button onClick={() => setUiScale(Math.max(0.8, uiScale - 0.1))} style={iconBtnStyle}><ZoomOut size={14 * uiScale} /></button>
                <span style={{ fontSize: '0.9em', minWidth: `${30 * uiScale}px`, textAlign: 'center' }}>{Math.round(uiScale * 100)}%</span>
                <button onClick={() => setUiScale(Math.min(1.5, uiScale + 0.1))} style={iconBtnStyle}><ZoomIn size={14 * uiScale} /></button>
            </div>
        </div>
    );
}