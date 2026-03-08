import { useState, useEffect } from 'react';
import { FolderGit2, FolderOpen, FileJson, Image as ImageIcon, ChevronRight, ChevronDown } from 'lucide-react';
import { useProjectStore } from '../../../store/useProjectStore';
import { useEditorStore } from '../../../store/useEditorStore';
import { fsReadDir, fsJoin, fsDirname, type FsDirEntry } from '../../../services/fs';
import { editorTheme as t } from '../../../theme/editorTheme';
import { ConfirmDialog } from '../../ConfirmDialog';
import {
    ExplorerContextMenu,
    type ExplorerContextMenuState,
} from './ExplorerContextMenu';
import { InlineNameInput } from './InlineNameInput';

function FileNode({ entry, parentPath, level = 0 }: { entry: FsDirEntry; parentPath: string; level?: number }) {
    const [isOpen, setIsOpen] = useState(false);
    const [children, setChildren] = useState<FsDirEntry[]>([]);
    const [fullPath, setFullPath] = useState<string>('');
    const [ctx, setCtx] = useState<ExplorerContextMenuState>(null);

    const [isRenaming, setIsRenaming] = useState(false);
    const [renameDraft, setRenameDraft] = useState(entry.name);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    const [createMode, setCreateMode] = useState<null | 'file' | 'folder'>(null);
    const [createDraft, setCreateDraft] = useState('');
    const [createTargetDir, setCreateTargetDir] = useState<string | null>(null);

    const { activeFile } = useProjectStore();
    const { uiScale } = useEditorStore();

    useEffect(() => {
        fsJoin(parentPath, entry.name).then(setFullPath);
    }, [parentPath, entry.name]);

    useEffect(() => {
        setRenameDraft(entry.name);
    }, [entry.name]);

    useEffect(() => {
        if (!ctx) return;
        const onDown = () => setCtx(null);
        const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setCtx(null);
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onEsc);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onEsc);
        };
    }, [ctx]);

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

        if (createMode === 'file') await createFileInDirectory(createTargetDir, name, '');
        else await createFolderInDirectory(createTargetDir, name);

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
                } catch (err) {
                    console.error('Failed to read directory:', err);
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

        setCtx({
            x: e.clientX,
            y: e.clientY,
            isDirectory: entry.isDirectory,
            path: fullPath,
            name: entry.name,
            onClose: () => setCtx(null),
            onAction: async (action) => {
                const { openProjectEntry } = await import('../../../services/openProjectEntry');

                switch (action) {
                    case 'open':
                        await openDefault();
                        break;
                    case 'openJson':
                        await openProjectEntry(fullPath, entry.name, { forceView: 'json' });
                        break;
                    case 'openTimeline':
                        await openProjectEntry(fullPath, entry.name, { forceView: 'timeline' });
                        break;
                    case 'rename':
                        setIsRenaming(true);
                        setRenameDraft(entry.name);
                        break;
                    case 'delete':
                        setConfirmDeleteOpen(true);
                        break;
                    case 'reveal': {
                        const { revealPathInSystem } = await import('../../../services/explorerFileActions');
                        await revealPathInSystem(fullPath);
                        break;
                    }
                    case 'newFile':
                        await startCreate('file');
                        break;
                    case 'newFolder':
                        await startCreate('folder');
                        break;
                }
            },
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
                tabIndex={0}
                onClick={handleClick}
                onContextMenu={onContextMenu}
                onKeyDown={onRowKeyDown}
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
                    outline: 'none',
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

                {isRenaming ? (
                    <InlineNameInput
                        uiScale={uiScale}
                        value={renameDraft}
                        onChange={setRenameDraft}
                        onSubmit={commitRename}
                        onCancel={() => {
                            setIsRenaming(false);
                            setRenameDraft(entry.name);
                        }}
                    />
                ) : (
                    <span>{entry.name}</span>
                )}
            </div>

            <ExplorerContextMenu uiScale={uiScale} menu={ctx} />

            <ConfirmDialog
                open={confirmDeleteOpen}
                title="Delete item?"
                message={`Delete "${entry.name}"? This cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                danger
                onCancel={() => setConfirmDeleteOpen(false)}
                onConfirm={async () => {
                    setConfirmDeleteOpen(false);
                    const { deletePath } = await import('../../../services/explorerFileActions');
                    await deletePath(fullPath);
                }}
            />

            {createMode && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: `${6 * uiScale}px`,
                        padding: `${4 * uiScale}px ${8 * uiScale}px`,
                        paddingLeft: `${((level + 1) * 12 + 8) * uiScale}px`,
                    }}
                >
                    <span style={{ width: 14 * uiScale }} />
                    <InlineNameInput
                        uiScale={uiScale}
                        value={createDraft}
                        onChange={setCreateDraft}
                        onSubmit={commitCreate}
                        onCancel={() => {
                            setCreateMode(null);
                            setCreateDraft('');
                            setCreateTargetDir(null);
                        }}
                    />
                </div>
            )}

            {isOpen &&
                children.map((child, idx) => (
                    <FileNode key={idx} entry={child} parentPath={fullPath} level={level + 1} />
                ))}
        </div>
    );
}

export function Explorer() {
    const { projectPath, files, treeRevision } = useProjectStore();
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
                        <FileNode key={`${treeRevision}:${projectPath}:${file.name}:${idx}`} entry={file} parentPath={projectPath} />
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
