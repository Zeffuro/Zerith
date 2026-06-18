import { ChevronDown, ChevronRight, FileAudio, FileCode, FileJson, FileText, FolderGit2, FolderOpen, Image as ImageIcon, RefreshCcw, Settings } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import {
    createFileInDirectory,
    createFolderInDirectory,
    deletePath,
    duplicatePath,
    renamePath,
    revealPathInSystem,
} from '../../../services/explorerFileActions';
import { type FsDirectoryEntry, fsDirname, fsJoin, fsReadDirectory, fsReadTextFile, fsWriteTextFile } from '../../../services/fs';
import { openAudiosheetEntry, openProjectEntry } from '../../../services/openProjectEntry';
import { executeExternalProjectTreeRefreshAction } from '../../../store/actions/projectTreeActions';
import { useProjectStore } from '../../../store/storeBootstrap';
import { useEditorStore } from '../../../store/useEditorStore';
import { useReferenceStore } from '../../../store/useReferenceStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { useWorkbenchStore } from '../../../store/useWorkbenchStore';
import { resolveComponentScale, editorTheme as t } from '../../../theme/editorTheme';
import { getSheetDescriptorPath, isSheetDescriptor } from '../../../utils/assetDescriptorUtilities';
import { AUDIO_EXT, getExtension, IMG_EXT } from '../../../utils/assetTypes';
import { ConfirmDialog } from '../../ConfirmDialog';
import {
    ExplorerContextMenu,
    type ExplorerContextMenuState,
} from './ExplorerContextMenu';
import { InlineNameInput } from './InlineNameInput';

type CreateFileMode = 'json' | 'scene' | 'text';
type CreateMode = 'folder' | CreateFileMode;

export function Explorer() {
    const { files, loadManifest, projectPath, treeRevision } = useProjectStore();
    const globalUiScale = useEditorStore((state) => state.uiScale);
    const explorerScale = useSettingsStore((state) => state.explorerScale);
    const uiScale = resolveComponentScale(globalUiScale, explorerScale);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const handleRefreshProject = useCallback(async () => {
        if (!projectPath || isRefreshing) return;

        setIsRefreshing(true);
        try {
            await executeExternalProjectTreeRefreshAction(projectPath);
            await loadManifest();
        } catch (error) {
            console.error('Failed to refresh project files:', error);
        } finally {
            setIsRefreshing(false);
        }
    }, [isRefreshing, loadManifest, projectPath]);

    return (
        <div
            className="zerith-scrollbar"
            style={{ backgroundColor: t.bg.panel, fontSize: `${12 * uiScale}px`, height: '100%', overflowY: 'auto', padding: `${12 * uiScale}px 0` }}
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
                <span>EXPLORER</span>
                <button
                    className="toolbar-btn"
                    disabled={!projectPath || isRefreshing}
                    onClick={() => { void handleRefreshProject(); }}
                    style={{
                        alignItems: 'center',
                        display: 'inline-flex',
                        justifyContent: 'center',
                        marginLeft: 'auto',
                        padding: `${4 * uiScale}px`,
                    }}
                    title="Refresh Project Files"
                    type="button"
                >
                    <RefreshCcw size={13 * uiScale} />
                </button>
            </div>

            {projectPath ? (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <ProjectRootNode projectPath={projectPath} uiScale={uiScale} />

                    {files.map((file) => (
                        <FileNode entry={file} key={`${projectPath}:${file.name}:${treeRevision}`} level={1} parentPath={projectPath} />
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

function FileNode({
    entry,
    isSheetChild = false,
    level = 0,
    parentPath,
}: {
    entry: FsDirectoryEntry;
    isSheetChild?: boolean;
    level?: number;
    parentPath: string;
}) {
    const [children, setChildren] = useState<FsDirectoryEntry[]>([]);
    const [fullPath, setFullPath] = useState<string>('');
    const [context, setContext] = useState<ExplorerContextMenuState>();

    const [isRenaming, setIsRenaming] = useState(false);
    const [renameDraft, setRenameDraft] = useState(entry.name);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    const [createMode, setCreateMode] = useState<CreateMode>();
    const [createDraft, setCreateDraft] = useState('');
    const [createTargetDirectory, setCreateTargetDirectory] = useState<string>();

    const { expandedPaths, projectPath, setPathExpanded, treeRevision } = useProjectStore();
    const activeTab = useWorkbenchStore((state) => state.activeTab());
    const getAssetReferenceCountForFilePath = useReferenceStore((state) => state.getAssetReferenceCountForFilePath);
    const globalUiScale = useEditorStore((state) => state.uiScale);
    const explorerScale = useSettingsStore((state) => state.explorerScale);
    const uiScale = resolveComponentScale(globalUiScale, explorerScale);
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

    const ensureDescriptorExists = useCallback(async (type: 'audiosheet' | 'spritesheet') => {
        if (!fullPath || entry.isDirectory) return;

        const descriptorPath = getSheetDescriptorPath(fullPath);

        try {
            await fsReadTextFile(descriptorPath);
            return descriptorPath;
        } catch {
            const descriptor = type === 'spritesheet'
                ? { format: 'atlas', frames: {}, source: entry.name }
                : { cues: {}, source: entry.name };
            await fsWriteTextFile(descriptorPath, `${JSON.stringify(descriptor, undefined, 2)}\n`);
            return descriptorPath;
        }
    }, [entry.isDirectory, entry.name, fullPath]);

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

    const startCreate = async (mode: CreateMode) => {
        const baseDirectory = entry.isDirectory ? fullPath : await fsDirname(fullPath);
        setCreateTargetDirectory(baseDirectory);
        setCreateMode(mode);
        setCreateDraft(getCreateDraft(mode));
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

        await (isFileCreateMode(createMode)
            ? createFileInDirectory(createTargetDirectory, name, getCreateFileContent(createMode))
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

        const canOpenAudiosheet = !entry.isDirectory && AUDIO_EXT.has(getExtension(entry.name));
        const canOpenSpritesheet = !entry.isDirectory && IMG_EXT.has(getExtension(entry.name));

        setContext({
            canOpenAudiosheet,
            canOpenSpritesheet,
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
                        case 'newFolder': {
                            await startCreate('folder');
                            break;
                        }
                        case 'newJson': {
                            await startCreate('json');
                            break;
                        }
                        case 'newScene': {
                            await startCreate('scene');
                            break;
                        }
                        case 'newText': {
                            await startCreate('text');
                            break;
                        }
                        case 'open': {
                            await openDefault();
                            break;
                        }
                        case 'openAudiosheet': {
                            const descriptorPath = await ensureDescriptorExists('audiosheet');
                            if (!descriptorPath) {
                                break;
                            }

                            await openAudiosheetEntry(descriptorPath);
                            break;
                        }
                        case 'openJson': {
                            await openProjectEntry(fullPath, entry.name, { forceView: 'json' });
                            break;
                        }
                        case 'openSpritesheet': {
                            await openProjectEntry(fullPath, entry.name, { openInSpritesheetEditor: true });
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

    const isSelected = activeTab?.path === fullPath;
    const assetReferenceCount = entry.isDirectory
        ? 0
        : getAssetReferenceCountForFilePath(fullPath, projectPath);
    const deleteMessage = assetReferenceCount > 0
        ? `Delete "${entry.name}"? Warning: this asset is referenced ${assetReferenceCount} time(s) in scripts/macros.`
        : `Delete "${entry.name}"? This cannot be undone.`;
    const iconSize = 14 * uiScale;
    const { descriptorChildrenByParent, topLevelEntries } = groupCompanionDescriptors(children);

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
                    color: isSelected ? t.text.primary : (entry.isDirectory ? t.text.normal : t.text.muted),
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
                    isOpen ? <FolderOpen color={t.icon.manifest} size={iconSize} /> : <FolderGit2 color={t.icon.manifest} size={iconSize} />
                ) : getFileIcon(entry.name, fullPath, iconSize, isSheetChild)}

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
                message={deleteMessage}
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
                topLevelEntries.map((child) => (
                    <div key={`${fullPath}:${child.name}:${child.isDirectory ? 'dir' : 'file'}:${treeRevision}`}>
                        <FileNode
                            entry={child}
                            level={level + 1}
                            parentPath={fullPath}
                        />

                        {(descriptorChildrenByParent.get(child.name) ?? []).map((descriptor) => (
                            <FileNode
                                entry={descriptor}
                                isSheetChild
                                key={`${fullPath}:${child.name}:descriptor:${descriptor.name}:${treeRevision}`}
                                level={level + 2}
                                parentPath={fullPath}
                            />
                        ))}
                    </div>
                ))}
        </div>
    );
}

function getCreateDraft(mode: CreateMode): string {
    switch (mode) {
        case 'folder': {
            return 'new-folder';
        }
        case 'json': {
            return 'new-data.json';
        }
        case 'scene': {
            return 'new-scene.json';
        }
        case 'text': {
            return 'notes.txt';
        }
    }
}

function getCreateFileContent(mode: CreateFileMode): string {
    switch (mode) {
        case 'json': {
            return '{}\n';
        }
        case 'scene': {
            return '[]\n';
        }
        case 'text': {
            return '';
        }
    }
}

function getPathBasename(path: string): string {
    return path.split(/[\\/]/).findLast(Boolean) || path;
}

function groupCompanionDescriptors(entries: FsDirectoryEntry[]): {
    descriptorChildrenByParent: Map<string, FsDirectoryEntry[]>;
    topLevelEntries: FsDirectoryEntry[];
} {
    const descriptorChildrenByParent = new Map<string, FsDirectoryEntry[]>();
    const parentAssetByDescriptorName = new Map<string, FsDirectoryEntry>();
    const hiddenDescriptors = new Set<string>();

    for (const entry of entries) {
        if (!isCompanionAsset(entry)) continue;
        parentAssetByDescriptorName.set(getSheetDescriptorPath(entry.name), entry);
    }

    for (const entry of entries) {
        if (entry.isDirectory || !isSheetDescriptor(entry.name)) continue;

        const parent = parentAssetByDescriptorName.get(entry.name);
        if (!parent) continue;

        hiddenDescriptors.add(entry.name);
        const children = descriptorChildrenByParent.get(parent.name) ?? [];
        children.push(entry);
        descriptorChildrenByParent.set(parent.name, children);
    }

    const topLevelEntries = entries.filter((entry) => !(hiddenDescriptors.has(entry.name) && isSheetDescriptor(entry.name)));
    return { descriptorChildrenByParent, topLevelEntries };
}

function isCompanionAsset(entry: FsDirectoryEntry): boolean {
    if (entry.isDirectory) return false;
    const extension = getExtension(entry.name);
    return IMG_EXT.has(extension) || AUDIO_EXT.has(extension);
}

function isFileCreateMode(mode: CreateMode): mode is CreateFileMode {
    return mode !== 'folder';
}

function ProjectRootNode({ projectPath, uiScale }: { projectPath: string; uiScale: number }) {
    const [context, setContext] = useState<ExplorerContextMenuState>();
    const [createMode, setCreateMode] = useState<CreateMode>();
    const [createDraft, setCreateDraft] = useState('');
    const projectName = getPathBasename(projectPath);

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

    const startCreate = (mode: CreateMode) => {
        setCreateMode(mode);
        setCreateDraft(getCreateDraft(mode));
    };

    const commitCreate = async () => {
        if (!createMode) return;
        const name = createDraft.trim();
        if (!name) {
            setCreateMode(undefined);
            return;
        }

        await (isFileCreateMode(createMode)
            ? createFileInDirectory(projectPath, name, getCreateFileContent(createMode))
            : createFolderInDirectory(projectPath, name));

        setCreateMode(undefined);
        setCreateDraft('');
    };

    const onContextMenu = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        setContext({
            canDelete: false,
            canDuplicate: false,
            canOpen: false,
            canOpenAudiosheet: false,
            canOpenSpritesheet: false,
            canRename: false,
            isDirectory: true,
            name: projectName,
            onAction: (action) => {
                void (async () => {
                    switch (action) {
                        case 'newFolder': {
                            startCreate('folder');
                            break;
                        }
                        case 'newJson': {
                            startCreate('json');
                            break;
                        }
                        case 'newScene': {
                            startCreate('scene');
                            break;
                        }
                        case 'newText': {
                            startCreate('text');
                            break;
                        }
                        case 'reveal': {
                            await revealPathInSystem(projectPath);
                            break;
                        }
                    }
                })();
            },
            onClose: () => setContext(undefined),
            path: projectPath,
            x: event.clientX,
            y: event.clientY,
        });
    };

    return (
        <div>
            <div
                onContextMenu={onContextMenu}
                style={{
                    alignItems: 'center',
                    borderRadius: '3px',
                    color: t.text.normal,
                    cursor: 'context-menu',
                    display: 'flex',
                    fontSize: 'inherit',
                    fontWeight: 'bold',
                    gap: `${6 * uiScale}px`,
                    padding: `${4 * uiScale}px ${8 * uiScale}px`,
                }}
            >
                <ChevronDown color={t.text.muted} size={14 * uiScale} />
                <FolderOpen color={t.icon.manifest} size={14 * uiScale} />
                <span>{projectName}</span>
            </div>

            <ExplorerContextMenu menu={context} uiScale={uiScale} />

            {createMode && (
                <div
                    style={{
                        alignItems: 'center',
                        display: 'flex',
                        gap: `${6 * uiScale}px`,
                        padding: `${4 * uiScale}px ${8 * uiScale}px`,
                        paddingLeft: `${20 * uiScale}px`,
                    }}
                >
                    <span style={{ width: 14 * uiScale }} />
                    <InlineNameInput
                        onCancel={() => {
                            setCreateMode(undefined);
                            setCreateDraft('');
                        }}
                        onChange={setCreateDraft}
                        onSubmit={commitCreate}
                        uiScale={uiScale}
                        value={createDraft}
                    />
                </div>
            )}
        </div>
    );
}

const AUDIO_EXTENSIONS = new Set(['.m4a', '.mp3', '.ogg', '.wav']);
const TEXT_EXTENSIONS = new Set(['.md', '.ts', '.tsx', '.txt']);

function getFileExtension(path: string): string {
    const index = path.lastIndexOf('.');
    return index === -1 ? '' : path.slice(index);
}

function getFileIcon(entryName: string, fullPath: string, iconSize: number, isSheetChild = false) {
    const normalizedPath = fullPath.replaceAll('\\', '/').toLowerCase();
    const lowerName = entryName.toLowerCase();
    const extension = getFileExtension(lowerName);

    if (lowerName === 'game.json') {
        return <Settings color={t.icon.manifest} size={iconSize} />;
    }

    if (extension && IMG_EXT.has(extension)) {
        return <ImageIcon color={t.icon.image} size={iconSize} />;
    }

    if (extension && AUDIO_EXTENSIONS.has(extension)) {
        return <FileAudio color={t.icon.audio} size={iconSize} />;
    }

    if (normalizedPath.includes('/scripts/') || normalizedPath.includes('/macros/')) {
        return <FileCode color={t.icon.script} size={iconSize} />;
    }

    if (extension && TEXT_EXTENSIONS.has(extension)) {
        return <FileText color={t.icon.text} size={iconSize} />;
    }

    if (extension === '.json') {
        return <FileJson color={isSheetChild ? t.icon.script : t.icon.data} size={iconSize} />;
    }

    return <FileText color={t.icon.text} size={iconSize} />;
}

