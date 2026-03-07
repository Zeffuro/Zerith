import { useState, useEffect } from 'react';
import { FolderGit2, FolderOpen, FileJson, Image as ImageIcon, ChevronRight, ChevronDown } from 'lucide-react';
import { readDir, readTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { useProjectStore } from '../../store/useProjectStore';
import { useEditorStore } from '../../store/useEditorStore';
import type { DirEntry } from '@tauri-apps/plugin-fs';
import { validateScript } from 'core';
import { editorTheme as t } from '../../theme/editorTheme';

function FileNode({ entry, parentPath, level = 0 }: { entry: DirEntry; parentPath: string; level?: number }) {
    const [isOpen, setIsOpen] = useState(false);
    const [children, setChildren] = useState<DirEntry[]>([]);
    const [fullPath, setFullPath] = useState<string>('');

    const { activeFile, setActiveFile } = useProjectStore();
    const { uiScale } = useEditorStore();

    useEffect(() => {
        join(parentPath, entry.name).then(setFullPath);
    }, [parentPath, entry.name]);

    const handleClick = async () => {
        if (entry.isDirectory) {
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
                    console.error('Failed to read directory:', err);
                }
            }
            setIsOpen(!isOpen);
            return;
        }

        if (!entry.name.endsWith('.json') || !fullPath) return;

        try {
            const contents = await readTextFile(fullPath);
            const data = JSON.parse(contents);

            if (Array.isArray(data)) {
                const validScript = validateScript(data);
                setActiveFile(fullPath, validScript);
                useProjectStore.getState().setActiveMacroName(null);
                useProjectStore.getState().setEditingAllMacrosFile(false);
                useProjectStore.getState().setMacroEntries([]);
                return;
            }

            if (data && typeof data === 'object') {
                const keys = Object.keys(data).filter((k) => Array.isArray(data[k]));
                const isLikelyMacros = keys.length > 0 && keys.length === Object.keys(data).length;

                if (isLikelyMacros) {
                    const entries = keys
                        .map((name) => ({ name, commands: validateScript(data[name]) }))
                        .sort((a, b) => a.name.localeCompare(b.name));

                    useProjectStore.getState().setActiveMacroName(null);
                    useProjectStore.getState().setEditingAllMacrosFile(true);
                    useProjectStore.getState().setMacroEntries(entries);
                    useProjectStore.getState().setActiveFile(fullPath, []);
                }
            }
        } catch (err) {
            console.error('Failed to read or parse JSON:', err);
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
                    backgroundColor: isSelected ? t.bg.selected : 'transparent',
                    color: isSelected ? t.text.primary : entry.isDirectory ? t.text.normal : '#aaa',
                    fontSize: 'inherit',
                }}
                onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = t.bg.hover;
                }}
                onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                }}
            >
                {entry.isDirectory ? (
                    isOpen ? <ChevronDown size={iconSize} color={t.text.muted} /> : <ChevronRight size={iconSize} color={t.text.muted} />
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

            {isOpen &&
                children.map((child, idx) => <FileNode key={idx} entry={child} parentPath={fullPath} level={level + 1} />)}
        </div>
    );
}

export function Explorer() {
    const { projectPath, files } = useProjectStore();
    const { uiScale } = useEditorStore();

    return (
        <div
            style={{ padding: `${12 * uiScale}px 0`, height: '100%', backgroundColor: t.bg.panel, overflowY: 'auto' }}
            className="zerith-scrollbar"
        >
            <div
                style={{
                    padding: `0 ${12 * uiScale}px`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: t.text.primary,
                    marginBottom: `${16 * uiScale}px`,
                    fontSize: '0.9em',
                    fontWeight: 'bold',
                    letterSpacing: '1px',
                }}
            >
                EXPLORER
            </div>

            {projectPath ? (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div
                        style={{
                            padding: `0 ${12 * uiScale}px`,
                            marginBottom: '8px',
                            color: t.text.muted,
                            fontSize: '0.85em',
                            textTransform: 'uppercase',
                            fontWeight: 'bold',
                        }}
                    >
                        {projectPath.split('\\').pop()?.split('/').pop()}
                    </div>

                    {files.map((file, idx) => (
                        <FileNode key={idx} entry={file} parentPath={projectPath} />
                    ))}
                </div>
            ) : (
                <div
                    style={{
                        padding: `0 ${12 * uiScale}px`,
                        fontSize: 'inherit',
                        color: t.text.faint,
                        fontStyle: 'italic',
                    }}
                >
                    No project opened.
                </div>
            )}
        </div>
    );
}