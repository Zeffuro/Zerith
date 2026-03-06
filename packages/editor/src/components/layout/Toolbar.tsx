import { Play, FolderOpen, Save, ZoomIn, ZoomOut } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir, writeTextFile } from '@tauri-apps/plugin-fs';
import { useProjectStore } from '../../store/useProjectStore';

export function Toolbar() {
    const { script, activeFile, uiScale, setUiScale } = useProjectStore();

    const setProject = useProjectStore(state => state.setProject);
    const loadManifest = useProjectStore(state => state.loadManifest);
    const triggerPlay = useProjectStore(state => state.triggerPlay);

    const handleOpenProject = async () => {
        try {
            const selectedPath = await open({ directory: true, multiple: false, title: 'Open Zerith Game' });
            if (selectedPath !== null) {
                const entries = await readDir(selectedPath);
                entries.sort((a, b) => {
                    if (a.isDirectory && !b.isDirectory) return -1;
                    if (!a.isDirectory && b.isDirectory) return 1;
                    return a.name.localeCompare(b.name);
                });
                setProject(selectedPath, entries);

                await loadManifest();
            }
        } catch (err) {
            console.error("Failed to open project:", err);
        }
    };

    const handleSave = async () => {
        if (!activeFile) return;
        try {
            await writeTextFile(activeFile, JSON.stringify(script, null, 4));
            console.log("Saved to:", activeFile);
        } catch (err) {
            console.error("Failed to save:", err);
        }
    };

    const iconBtnStyle = {
        background: 'transparent', border: 'none', color: '#aaa',
        cursor: 'pointer', padding: `${4 * uiScale}px`
    };

    const buttonStyle = {
        display: 'flex', alignItems: 'center', gap: `${6 * uiScale}px`,
        background: 'transparent', color: '#ccc', border: '1px solid #555',
        padding: `${4 * uiScale}px ${12 * uiScale}px`,
        borderRadius: '4px', cursor: 'pointer', fontSize: 'inherit'
    };

    return (
        <div style={{ height: `${40 * uiScale}px`, backgroundColor: '#2d2d2d', display: 'flex', alignItems: 'center', padding: `0 ${16 * uiScale}px`, borderBottom: '1px solid #3c3c3c' }}>
            <strong style={{ color: '#fff', marginRight: `${20 * uiScale}px`, fontSize: '1.1em' }}>Zerith Editor</strong>

            <button onClick={handleOpenProject} style={buttonStyle}>
                <FolderOpen size={14 * uiScale} /> Open Project
            </button>
            <button onClick={handleSave} style={{ ...buttonStyle, marginLeft: '8px' }}>
                <Save size={14 * uiScale} /> Save Project
            </button>
            <button onClick={triggerPlay} style={{ ...buttonStyle, marginLeft: 'auto', background: '#0e639c', border: 'none', color: 'white' }}>
                <Play size={14 * uiScale} /> Play Test
            </button>

            <div style={{ marginLeft: `${16 * uiScale}px`, display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid #444', paddingLeft: `${16 * uiScale}px` }}>
                <button onClick={() => setUiScale(Math.max(0.8, uiScale - 0.1))} style={iconBtnStyle}><ZoomOut size={14 * uiScale} /></button>
                <span style={{ fontSize: '0.9em', minWidth: `${30 * uiScale}px`, textAlign: 'center' }}>{Math.round(uiScale * 100)}%</span>
                <button onClick={() => setUiScale(Math.min(1.5, uiScale + 0.1))} style={iconBtnStyle}><ZoomIn size={14 * uiScale} /></button>
            </div>
        </div>
    );
}