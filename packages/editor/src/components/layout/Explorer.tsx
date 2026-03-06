import { useState, useEffect } from 'react';
import { FolderGit2, FolderOpen, FileJson, Image as ImageIcon, ChevronRight, ChevronDown } from 'lucide-react';
import { readDir, readTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { useProjectStore } from '../../store/useProjectStore';
import type { DirEntry } from '@tauri-apps/plugin-fs';
import { validateScript } from 'core';

// A recursive component to render files and folders
function FileNode({ entry, parentPath, level = 0 }: { entry: DirEntry; parentPath: string; level?: number }) {
    const [isOpen, setIsOpen] = useState(false);
    const [children, setChildren] = useState<DirEntry[]>([]);
    const [fullPath, setFullPath] = useState<string>('');

    const activeFile = useProjectStore(state => state.activeFile);
    const setActiveFile = useProjectStore(state => state.setActiveFile);

    // Resolve the absolute path of this file/folder
    useEffect(() => {
        join(parentPath, entry.name).then(setFullPath);
    },[parentPath, entry.name]);

    const handleClick = async () => {
        if (entry.isDirectory) {
            // If opening a folder for the first time, read its contents
            if (!isOpen && children.length === 0 && fullPath) {
                try {
                    const entries = await readDir(fullPath);
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
            // It's a file! If it's a JSON script, load it into the editor.
            if (entry.name.endsWith('.json') && fullPath) {
                try {
                    const contents = await readTextFile(fullPath);
                    const data = JSON.parse(contents);

                    // Basic check: Scripts are arrays. Manifests/Characters are objects.
                    if (Array.isArray(data)) {
                        // Use the Engine's Zod validator!
                        const validScript = validateScript(data);
                        setActiveFile(fullPath, validScript);
                    } else {
                        console.warn("Selected JSON is not a script array. (Might be a manifest/items file)");
                    }
                } catch (err) {
                    console.error("Failed to read or parse JSON:", err);
                }
            }
        }
    };

    const isSelected = activeFile === fullPath;

    return (
        <div>
            <div
                onClick={handleClick}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 8px',
                    paddingLeft: `${level * 12 + 8}px`,
                    cursor: 'pointer',
                    borderRadius: '3px',
                    backgroundColor: isSelected ? '#04395e' : 'transparent',
                    color: isSelected ? '#fff' : (entry.isDirectory ? '#ccc' : '#aaa')
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#2a2d2e'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
                {entry.isDirectory ? (
                    isOpen ? <ChevronDown size={14} color="#888" /> : <ChevronRight size={14} color="#888" />
                ) : (
                    <span style={{ width: 14 }} /> // Spacer for file alignment
                )}

                {entry.isDirectory ? (
                    isOpen ? <FolderOpen size={14} color="#dcb67a" /> : <FolderGit2 size={14} color="#dcb67a" />
                ) : entry.name.endsWith('.json') ? (
                    <FileJson size={14} color="#ce9178" />
                ) : (
                    <ImageIcon size={14} color="#4ec9b0" />
                )}

                <span style={{ fontSize: '13px' }}>{entry.name}</span>
            </div>

            {/* Render children if folder is open */}
            {isOpen && children.map((child, idx) => (
                <FileNode key={idx} entry={child} parentPath={fullPath} level={level + 1} />
            ))}
        </div>
    );
}

export function Explorer() {
    const { projectPath, files } = useProjectStore();

    return (
        <div style={{ padding: '12px 0', height: '100%', backgroundColor: '#252526', overflowY: 'auto' }}>
            <div style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '16px', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>
                EXPLORER
            </div>

            {projectPath ? (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '0 12px', marginBottom: '8px', color: '#888', fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                        {projectPath.split('\\').pop()?.split('/').pop()}
                    </div>

                    {/* Render top level files/folders */}
                    {files.map((file, idx) => (
                        <FileNode key={idx} entry={file} parentPath={projectPath} />
                    ))}
                </div>
            ) : (
                <div style={{ padding: '0 12px', fontSize: '13px', color: '#666', fontStyle: 'italic' }}>
                    No project opened.
                </div>
            )}
        </div>
    );
}