import { ChevronDown, ChevronRight, FileJson, FolderGit2, FolderOpen, Image as ImageIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import {
    createFileInDirectory,
    createFolderInDirectory,
    deletePath,
    duplicatePath,
    renamePath,
    revealPathInSystem,
} from '../../../services/explorerFileActions';
import { type FsDirectoryEntry, fsDirname, fsJoin, fsReadDirectory } from '../../../services/fs';
import { openProjectEntry } from '../../../services/openProjectEntry';
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

                    {files.map((file) => (
                        <FileNode entry={file} key={`${projectPath}:${file.name}:${treeRevision}`} parentPath={projectPath} />
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

function FileNode({ entry, level = 0, parentPath }: { entry: FsDirectoryEntry; level?: number; parentPath: string; }) {
    const [children, setChildren] = useState<FsDirectoryEntry[]>([]);
    const [fullPath, setFullPath] = useState<string>('');
    const [context, setContext] = useState<ExplorerContextMenuState>();

    const [isRenaming, setIsRenaming] = useState(false);
    const [renameDraft, setRenameDraft] = useState(entry.name);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    const [createMode, setCreateMode] = useState<'file' | 'folder'>();
    const [createDraft, setCreateDraft] = useState('');
    const [createTargetDirectory, setCreateTargetDirectory] = useState<string>();

    const { activeFile, expandedPaths, setPathExpanded, treeRevision } = useProjectStore();
    const { uiScale } = useEditorStore();
    const isOpen = entry.isDirectory && !!fullPath && expandedPaths.includes(fullPath);

    useEffect(() => {
        void fsJoin(parentPath, entry.name).then(setFullPath);
    }, [parentPath, entry.name]);

    useEffect(() => {
        if (!context) return;
        const onDown = () => setContext(undefined);
        const onEscape = (event: KeyboardEvent) => event.key === 'Escape' && setContext(undefined);
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onEscape);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onEscape);
        };
    }, [context]);

    const loadChildren = useCallback(async () => {
        if (!fullPath || !entry.isDirectory) return;
        try {
            const entries = await fsReadDirectory(fullPath);
            const sortedEntries = entries.toSorted((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
            });
            setChildren(sortedEntries);
        } catch (error) {
            console.error('Failed to read directory:', error);
        }
    }, [entry.isDirectory, fullPath]);

    useEffect(() => {
        if (!isOpen || !entry.isDirectory || !fullPath) return;

        void fsReadDirectory(fullPath)
            .then((entries) => {
                const sortedEntries = entries.toSorted((a, b) => {
                    if (a.isDirectory && !b.isDirectory) return -1;
                    if (!a.isDirectory && b.isDirectory) return 1;
                    return a.name.localeCompare(b.name);
                });
                setChildren(sortedEntries);
            })
            .catch((error: unknown) => {
                console.error('Failed to read directory:', error);
            });
    }, [entry.isDirectory, fullPath, isOpen, treeRevision]);

    const openDefault = async () => {
        if (!fullPath) return;
        await openProjectEntry(fullPath, entry.name);
    };

    const commitRename = async () => {
        const next = renameDraft.trim();
        if (!next || next === entry.name) {
            setIsRenaming(false);
            setRenameDraft(entry.name);
            return;
        }
        await renamePath(fullPath, next);
        setIsRenaming(false);
    };

    const startCreate = async (mode: 'file' | 'folder') => {
        const baseDirectory = entry.isDirectory ? fullPath : await fsDirname(fullPath);
        setCreateTargetDirectory(baseDirectory);
        setCreateMode(mode);
        setCreateDraft(mode === 'file' ? 'new-file.json' : 'new-folder');
        if (entry.isDirectory && !isOpen && fullPath) {
            setPathExpanded(fullPath, true);
        }
    };

    const commitCreate = async () => {
        if (!createMode || !createTargetDirectory) return;
        const name = createDraft.trim();
        if (!name) {
            setCreateMode(undefined);
            return;
        }

        await (createMode === 'file'
            ? createFileInDirectory(createTargetDirectory, name, '')
            : createFolderInDirectory(createTargetDirectory, name));

        setCreateMode(undefined);
        setCreateDraft('');
        setCreateTargetDirectory(undefined);
    };

    const handleClick = async () => {
        if (isRenaming) return;

        if (entry.isDirectory) {
            if (!isOpen && children.length === 0) {
                await loadChildren();
            }
            if (!fullPath) return;
            setPathExpanded(fullPath, !isOpen);
            return;
        }

        await openDefault();
    };

    const onContextMenu = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (!fullPath) return;

        setContext({
            isDirectory: entry.isDirectory,
            name: entry.name,
            onAction: (action) => {
                void (async () => {
                    switch (action) {
                        case 'delete': {
                            setConfirmDeleteOpen(true);
                            break;
                        }
                        case 'duplicate': {
                            await duplicatePath(fullPath);
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
                            await revealPathInSystem(fullPath);
                            break;
                        }
                    }
                })();
            },
            onClose: () => setContext(undefined),
            path: fullPath,
            x: event.clientX,
            y: event.clientY,
        });
    };

    const onRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'F2' && !isRenaming) {
            event.preventDefault();
            setIsRenaming(true);
            setRenameDraft(entry.name);
            return;
        }

        if (event.key === 'Enter' && !entry.isDirectory && !isRenaming) {
            event.preventDefault();
            void openDefault();
        }
    };

    const isSelected = activeFile === fullPath;
    const iconSize = 14 * uiScale;

    return (
        <div>
            <div
                onClick={() => {
                    void handleClick();
                }}
                onContextMenu={onContextMenu}
                onKeyDown={onRowKeyDown}
                onMouseEnter={(event) => {
                    if (!isSelected) event.currentTarget.style.backgroundColor = t.bg.hover;
                }}
                onMouseLeave={(event) => {
                    if (!isSelected) event.currentTarget.style.backgroundColor = 'transparent';
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
                onConfirm={() => {
                    setConfirmDeleteOpen(false);
                    void (async () => {
                        await deletePath(fullPath);
                    })();
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
                            setCreateMode(undefined);
                            setCreateDraft('');
                            setCreateTargetDirectory(undefined);
                        }}
                        onChange={setCreateDraft}
                        onSubmit={commitCreate}
                        uiScale={uiScale}
                        value={createDraft}
                    />
                </div>
            )}

            {isOpen &&
                children.map((child) => (
                    <FileNode
                        entry={child}
                        key={`${fullPath}:${child.name}:${child.isDirectory ? 'dir' : 'file'}:${treeRevision}`}
                        level={level + 1}
                        parentPath={fullPath}
                    />
                ))}
        </div>
    );
}
