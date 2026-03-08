import { ChevronDown, ChevronRight, FileJson, FolderGit2, FolderOpen, Image as ImageIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { type FsDirEntry, fsDirname, fsJoin, fsReadDir } from '../../../services/fs';
import { useEditorStore } from '../../../store/useEditorStore';
import { useProjectStore } from '../../../store/useProjectStore';
import { editorTheme as t } from '../../../theme/editorTheme';
import { ConfirmDialog } from '../../ConfirmDialog';
import {
    ExplorerContextMenu,
    type ExplorerContextMenuState,
} from './ExplorerContextMenu';
import { InlineNameInput } from './InlineNameInput';

export function Explorer() {
    const { files, projectPath, treeRevision } = useProjectStore();
    const { uiScale } = useEditorStore();

    return (
        <div
            className="zerith-scrollbar"
            style={{ backgroundColor: t.bg.panel, height: '100%', overflowY: 'auto', padding: `${12 * uiScale}px 0` }}
        >
            <div
                style={{
                    alignItems: 'center',
                    color: t.text.primary,
                    display: 'flex',
                    fontSize: '0.9em',
                    fontWeight: 'bold',
                    gap: '8px',
                    letterSpacing: '1px',
                    marginBottom: `${16 * uiScale}px`,
                    padding: `0 ${12 * uiScale}px`,
                }}
            >
                EXPLORER
            </div>

            {projectPath ? (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div
                        style={{
                            color: t.text.muted,
                            fontSize: '0.85em',
                            fontWeight: 'bold',
                            marginBottom: '8px',
                            padding: `0 ${12 * uiScale}px`,
                            textTransform: 'uppercase',
                        }}
                    >
                        {projectPath.split('\\').pop()?.split('/').pop()}
                    </div>

                    {files.map((file, index) => (
                        <FileNode entry={file} key={`${treeRevision}:${projectPath}:${file.name}:${index}`} parentPath={projectPath} />
                    ))}
                </div>
            ) : (
                <div
                    style={{
                        color: t.text.faint,
                        fontSize: 'inherit',
                        fontStyle: 'italic',
                        padding: `0 ${12 * uiScale}px`,
                    }}
                >
                    No project opened.
                </div>
            )}
        </div>
    );
}

function FileNode({ entry, level = 0, parentPath }: { entry: FsDirEntry; level?: number; parentPath: string; }) {
    const [isOpen, setIsOpen] = useState(false);
    const [children, setChildren] = useState<FsDirEntry[]>([]);
    const [fullPath, setFullPath] = useState<string>('');
    const [context, setContext] = useState<ExplorerContextMenuState>(null);

    const [isRenaming, setIsRenaming] = useState(false);
    const [renameDraft, setRenameDraft] = useState(entry.name);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    const [createMode, setCreateMode] = useState<'file' | 'folder' | null>(null);
    const [createDraft, setCreateDraft] = useState('');
    const [createTargetDir, setCreateTargetDir] = useState<null | string>(null);

    const { activeFile } = useProjectStore();
    const { uiScale } = useEditorStore();

    useEffect(() => {
        fsJoin(parentPath, entry.name).then(setFullPath);
    }, [parentPath, entry.name]);

    useEffect(() => {
        setRenameDraft(entry.name);
    }, [entry.name]);

    useEffect(() => {
        if (!context) return;
        const onDown = () => setContext(null);
        const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setContext(null);
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onEsc);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onEsc);
        };
    }, [context]);

    const openDefault = async () => {
        if (!fullPath) return;
        const { openProjectEntry } = await import('../../../services/openProjectEntry');
        await openProjectEntry(fullPath, entry.name);
    };

    const commitRename = async () => {
        const next = renameDraft.trim();
        if (!next || next === entry.name) {
            setIsRenaming(false);
            setRenameDraft(entry.name);
            return;
        }
        const { renamePath } = await import('../../../services/explorerFileActions');
        await renamePath(fullPath, next);
        setIsRenaming(false);
    };

    const startCreate = async (mode: 'file' | 'folder') => {
        const baseDir = entry.isDirectory ? fullPath : await fsDirname(fullPath);
        setCreateTargetDir(baseDir);
        setCreateMode(mode);
        setCreateDraft(mode === 'file' ? 'new-file.json' : 'new-folder');
        if (entry.isDirectory && !isOpen) setIsOpen(true);
    };

    const commitCreate = async () => {
        if (!createMode || !createTargetDir) return;
        const name = createDraft.trim();
        if (!name) {
            setCreateMode(null);
            return;
        }

        const {
            createFileInDirectory,
            createFolderInDirectory,
        } = await import('../../../services/explorerFileActions');

        await (createMode === 'file' ? createFileInDirectory(createTargetDir, name, '') : createFolderInDirectory(createTargetDir, name));

        setCreateMode(null);
        setCreateDraft('');
        setCreateTargetDir(null);
    };

    const handleClick = async () => {
        if (isRenaming) return;

        if (entry.isDirectory) {
            if (!isOpen && children.length === 0 && fullPath) {
                try {
                    const entries = await fsReadDir(fullPath);
                    entries.sort((a, b) => {
                        if (a.isDirectory && !b.isDirectory) return -1;
                        if (!a.isDirectory && b.isDirectory) return 1;
                        return a.name.localeCompare(b.name);
                    });
                    setChildren(entries);
                } catch (error) {
                    console.error('Failed to read directory:', error);
                }
            }
            setIsOpen((v) => !v);
            return;
        }

        await openDefault();
    };

    const onContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!fullPath) return;

        setContext({
            isDirectory: entry.isDirectory,
            name: entry.name,
            onAction: async (action) => {
                const { openProjectEntry } = await import('../../../services/openProjectEntry');

                switch (action) {
                    case 'delete': {
                        setConfirmDeleteOpen(true);
                        break;
                    }
                    case 'newFile': {
                        await startCreate('file');
                        break;
                    }
                    case 'newFolder': {
                        await startCreate('folder');
                        break;
                    }
                    case 'open': {
                        await openDefault();
                        break;
                    }
                    case 'openJson': {
                        await openProjectEntry(fullPath, entry.name, { forceView: 'json' });
                        break;
                    }
                    case 'openTimeline': {
                        await openProjectEntry(fullPath, entry.name, { forceView: 'timeline' });
                        break;
                    }
                    case 'rename': {
                        setIsRenaming(true);
                        setRenameDraft(entry.name);
                        break;
                    }
                    case 'reveal': {
                        const { revealPathInSystem } = await import('../../../services/explorerFileActions');
                        await revealPathInSystem(fullPath);
                        break;
                    }
                }
            },
            onClose: () => setContext(null),
            path: fullPath,
            x: e.clientX,
            y: e.clientY,
        });
    };

    const onRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'F2' && !isRenaming) {
            e.preventDefault();
            setIsRenaming(true);
            setRenameDraft(entry.name);
            return;
        }

        if (e.key === 'Enter' && !entry.isDirectory && !isRenaming) {
            e.preventDefault();
            void openDefault();
        }
    };

    const isSelected = activeFile === fullPath;
    const iconSize = 14 * uiScale;

    return (
        <div>
            <div
                onClick={handleClick}
                onContextMenu={onContextMenu}
                onKeyDown={onRowKeyDown}
                onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = t.bg.hover;
                }}
                onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                }}
                style={{
                    alignItems: 'center',
                    backgroundColor: isSelected ? t.bg.selected : 'transparent',
                    borderRadius: '3px',
                    color: isSelected ? t.text.primary : (entry.isDirectory ? t.text.normal : '#aaa'),
                    cursor: 'pointer',
                    display: 'flex',
                    fontSize: 'inherit',
                    gap: `${6 * uiScale}px`,
                    outline: 'none',
                    padding: `${4 * uiScale}px ${8 * uiScale}px`,
                    paddingLeft: `${(level * 12 + 8) * uiScale}px`,
                }}
                tabIndex={0}
            >
                {entry.isDirectory ? (
                    isOpen ? <ChevronDown color={t.text.muted} size={iconSize} /> : <ChevronRight color={t.text.muted} size={iconSize} />
                ) : (
                    <span style={{ width: iconSize }} />
                )}

                {entry.isDirectory ? (
                    isOpen ? <FolderOpen color="#dcb67a" size={iconSize} /> : <FolderGit2 color="#dcb67a" size={iconSize} />
                ) : (entry.name.endsWith('.json') ? (
                    <FileJson color="#ce9178" size={iconSize} />
                ) : (
                    <ImageIcon color="#4ec9b0" size={iconSize} />
                ))}

                {isRenaming ? (
                    <InlineNameInput
                        onCancel={() => {
                            setIsRenaming(false);
                            setRenameDraft(entry.name);
                        }}
                        onChange={setRenameDraft}
                        onSubmit={commitRename}
                        uiScale={uiScale}
                        value={renameDraft}
                    />
                ) : (
                    <span>{entry.name}</span>
                )}
            </div>

            <ExplorerContextMenu menu={context} uiScale={uiScale} />

            <ConfirmDialog
                cancelText="Cancel"
                confirmText="Delete"
                danger
                message={`Delete "${entry.name}"? This cannot be undone.`}
                onCancel={() => setConfirmDeleteOpen(false)}
                onConfirm={async () => {
                    setConfirmDeleteOpen(false);
                    const { deletePath } = await import('../../../services/explorerFileActions');
                    await deletePath(fullPath);
                }}
                open={confirmDeleteOpen}
                title="Delete item?"
            />

            {createMode && (
                <div
                    style={{
                        alignItems: 'center',
                        display: 'flex',
                        gap: `${6 * uiScale}px`,
                        padding: `${4 * uiScale}px ${8 * uiScale}px`,
                        paddingLeft: `${((level + 1) * 12 + 8) * uiScale}px`,
                    }}
                >
                    <span style={{ width: 14 * uiScale }} />
                    <InlineNameInput
                        onCancel={() => {
                            setCreateMode(null);
                            setCreateDraft('');
                            setCreateTargetDir(null);
                        }}
                        onChange={setCreateDraft}
                        onSubmit={commitCreate}
                        uiScale={uiScale}
                        value={createDraft}
                    />
                </div>
            )}

            {isOpen &&
                children.map((child, index) => (
                    <FileNode entry={child} key={index} level={level + 1} parentPath={fullPath} />
                ))}
        </div>
    );
}
