import { Play, FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { readDir } from '@tauri-apps/plugin-fs';
import { useProjectStore } from '../../store/useProjectStore';

export function Toolbar() {
    const setProject = useProjectStore(state => state.setProject);

    const handleOpenProject = async () => {
        try {
            const selectedPath = await open({ directory: true, multiple: false, title: 'Open Zerith Game' });
            if (selectedPath && typeof selectedPath === 'string') {
                const entries = await readDir(selectedPath);
                entries.sort((a, b) => {
                    if (a.isDirectory && !b.isDirectory) return -1;
                    if (!a.isDirectory && b.isDirectory) return 1;
                    return a.name.localeCompare(b.name);
                });
                setProject(selectedPath, entries);
            }
        } catch (err) {
            console.error("Failed to open project:", err);
        }
    };

    return (
        <div style={{ height: '40px', backgroundColor: '#2d2d2d', display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid #3c3c3c' }}>
            <strong style={{ color: '#fff', marginRight: '20px' }}>Zerith Editor</strong>
            <button onClick={handleOpenProject} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', color: '#ccc', border: '1px solid #555', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
                <FolderOpen size={14} /> Open Project
            </button>
            <button style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', background: '#0e639c', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
                <Play size={14} /> Play Test
            </button>
        </div>
    );
}