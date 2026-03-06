import { useState, useEffect } from 'react';
import { FolderGit2, FolderOpen, FileJson, Image as ImageIcon, ChevronRight, ChevronDown } from 'lucide-react';
import { readDir, readTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { useProjectStore } from '../../store/useProjectStore';
import type { DirEntry } from '@tauri-apps/plugin-fs';
import { validateScript } from 'core';

function FileNode({ entry, parentPath, level = 0 }: { entry: DirEntry; parentPath: string; level?: number }) {
    const [isOpen, setIsOpen] = useState(false);
    const [children, setChildren] = useState<DirEntry[]>([]);
    const [fullPath, setFullPath] = useState<string>('');

    const activeFile = useProjectStore(state => state.activeFile);
    const setActiveFile = useProjectStore(state => state.setActiveFile);
    const uiScale = useProjectStore(state => state.uiScale);

    useEffect(() => {
        join(parentPath, entry.name).then(setFullPath);
    },[parentPath, entry.name]);

    const handleClick = async () => {
        if (entry.isDirectory) {
            if (!isOpen && children.length === 0 && fullPath) {
                try {
                    const entries = await readDir(fullPath);
                    // Sort directories first
                    entries.sort((a, b) => {
                        if (a.isDirectory && !b.isDirectory) return -1;
                        if (!a.isDirectory && b.isDirectory) return 1;
                        return a.name.localeCompare(b.name);
                    });
                    setChildren(entries);
                } catch (err) {
                    console.error("Failed to read directory:", err);
                }
            }
            setIsOpen(!isOpen);
        } else {
            if (entry.name.endsWith('.json') && fullPath) {
                try {
                    const contents = await readTextFile(fullPath);
                    const data = JSON.parse(contents);

                    if (Array.isArray(data)) {
                        const validScript = validateScript(data);
                        setActiveFile(fullPath, validScript);
                    } else {
                        console.warn("Selected JSON is not a script array.");
                    }
                } catch (err) {
                    console.error("Failed to read or parse JSON:", err);
                }
            }
        }
    };

    const isSelected = activeFile === fullPath;
    const iconSize = 14 * uiScale;

    return (
        <div>
            <div
                onClick={handleClick}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: `${6 * uiScale}px`,
                    padding: `${4 * uiScale}px ${8 * uiScale}px`,
                    paddingLeft: `${(level * 12 + 8) * uiScale}px`,
                    cursor: 'pointer',
                    borderRadius: '3px',
                    backgroundColor: isSelected ? '#04395e' : 'transparent',
                    color: isSelected ? '#fff' : (entry.isDirectory ? '#ccc' : '#aaa'),
                    fontSize: 'inherit'
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#2a2d2e'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
                {entry.isDirectory ? (
                    isOpen ? <ChevronDown size={iconSize} color="#888" /> : <ChevronRight size={iconSize} color="#888" />
                ) : (
                    <span style={{ width: iconSize }} />
                )}

                {entry.isDirectory ? (
                    isOpen ? <FolderOpen size={iconSize} color="#dcb67a" /> : <FolderGit2 size={iconSize} color="#dcb67a" />
                ) : entry.name.endsWith('.json') ? (
                    <FileJson size={iconSize} color="#ce9178" />
                ) : (
                    <ImageIcon size={iconSize} color="#4ec9b0" />
                )}

                <span>{entry.name}</span>
            </div>

            {isOpen && children.map((child, idx) => (
                <FileNode key={idx} entry={child} parentPath={fullPath} level={level + 1} />
            ))}
        </div>
    );
}

export function Explorer() {
    const { projectPath, files, uiScale } = useProjectStore();

    return (
        <div style={{ padding: `${12 * uiScale}px 0`, height: '100%', backgroundColor: '#252526', overflowY: 'auto' }}>
            <div style={{ padding: `0 ${12 * uiScale}px`, display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: `${16 * uiScale}px`, fontSize: '0.9em', fontWeight: 'bold', letterSpacing: '1px' }}>
                EXPLORER
            </div>

            {projectPath ? (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: `0 ${12 * uiScale}px`, marginBottom: '8px', color: '#888', fontSize: '0.85em', textTransform: 'uppercase', fontWeight: 'bold' }}>
                        {projectPath.split('\\').pop()?.split('/').pop()}
                    </div>

                    {files.map((file, idx) => (
                        <FileNode key={idx} entry={file} parentPath={projectPath} />
                    ))}
                </div>
            ) : (
                <div style={{ padding: `0 ${12 * uiScale}px`, fontSize: 'inherit', color: '#666', fontStyle: 'italic' }}>
                    No project opened.
                </div>
            )}
        </div>
    );
}