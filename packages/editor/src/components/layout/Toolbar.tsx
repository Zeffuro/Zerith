import { Play, FolderOpen, Save } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir } from '@tauri-apps/plugin-fs';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { useProjectStore } from '../../store/useProjectStore';

export function Toolbar() {
    const { script, activeFile } = useProjectStore();

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

    return (
        <div style={{ height: '40px', backgroundColor: '#2d2d2d', display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid #3c3c3c' }}>
            <strong style={{ color: '#fff', marginRight: '20px' }}>Zerith Editor</strong>
            <button onClick={handleOpenProject} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', color: '#ccc', border: '1px solid #555', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
                <FolderOpen size={14} /> Open Project
            </button>
            <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', color: '#ccc', border: '1px solid #555', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
                <Save size={14} /> Save Project
            </button>
            <button onClick={triggerPlay} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', background: '#0e639c', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
                <Play size={14} /> Play Test
            </button>
        </div>
    );
}