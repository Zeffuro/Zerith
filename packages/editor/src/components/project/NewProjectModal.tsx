import { useEffect, useState } from 'react';

import { useBackdropDismissal } from '../../hooks/useBackdropDismissal';
import { createNewProject } from '../../services/createNewProject';
import { fsPickDirectory } from '../../services/fs';
import { openProjectEntry } from '../../services/openProjectEntry';
import { isTauriRuntime } from '../../services/runtime/runtimeEnvironment';
import { closeProject } from '../../store/actions/projectOpenActions';
import { useProjectStore } from '../../store/storeBootstrap';
import { useEditorStore } from '../../store/useEditorStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { styles } from '../../theme/styleHelpers';
import { openInitialProjectEntry as openInitialProjectEntryModel } from '../tools/commandPaletteModel';

export function NewProjectModal() {
    const addRecentProject = useEditorStore((state) => state.addRecentProject);
    const closeNewProjectModal = useEditorStore((state) => state.closeNewProjectModal);
    const isOpen = useEditorStore((state) => state.isNewProjectModalOpen);
    const uiScale = useEditorStore((state) => state.uiScale);
    const openProjectFromManifest = useProjectStore((state) => state.openProjectFromManifest);

    const [author, setAuthor] = useState('');
    const [directory, setDirectory] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [name, setName] = useState('My New Game');
    const [statusMessage, setStatusMessage] = useState<string | undefined>();

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setAuthor('');
        setDirectory('');
        setIsCreating(false);
        setName('My New Game');
        setStatusMessage(undefined);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !isCreating) {
                closeNewProjectModal();
            }
        };

        globalThis.addEventListener('keydown', onKeyDown);
        return () => {
            globalThis.removeEventListener('keydown', onKeyDown);
        };
    }, [closeNewProjectModal, isCreating, isOpen]);
    const backdropDismissal = useBackdropDismissal(closeNewProjectModal, { disabled: isCreating });

    if (!isOpen) {
        return;
    }

    const canCreate = directory.trim().length > 0 && name.trim().length > 0 && !isCreating;

    const handleOpenInitialProjectEntry = async () => {
        const { expandToPath, manifest, projectPath } = useProjectStore.getState();
        await openInitialProjectEntryModel({
            expandToPath,
            manifest,
            openProjectEntry,
            projectPath,
        });
    };

    const handleBrowseDirectory = async () => {
        if (isCreating) return;

        try {
            const selectedDirectory = await fsPickDirectory('Select a project directory');

            if (!selectedDirectory) {
                return;
            }

            setDirectory(selectedDirectory);
            setStatusMessage(undefined);
        } catch (error) {
            console.error('Failed to open directory picker:', error);
            setStatusMessage(`Failed to open directory picker: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const handleCreateProject = async () => {
        if (!canCreate) {
            return;
        }

        setIsCreating(true);
        setStatusMessage('Creating project...');

        try {
            const result = await createNewProject({
                author,
                directory,
                name,
            });

            closeProject();
            await openProjectFromManifest(result.manifestPath);
            if (isTauriRuntime()) addRecentProject(result.manifestPath);
            await handleOpenInitialProjectEntry();
            closeNewProjectModal();
        } catch (error) {
            console.error('Failed to create project:', error);
            setStatusMessage(`Failed to create project: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div
            {...backdropDismissal}
            style={{
                background: 'rgba(0, 0, 0, 0.45)',
                display: 'grid',
                inset: 0,
                placeItems: 'center',
                position: 'fixed',
                zIndex: 5400,
            }}
        >
            <div
                onClick={(event) => event.stopPropagation()}
                style={{
                    background: t.bg.panel,
                    border: `1px solid ${t.border.normal}`,
                    borderRadius: t.radius.lg,
                    boxShadow: t.shadow.popupStrong,
                    color: t.text.primary,
                    display: 'grid',
                    gap: `${10 * uiScale}px`,
                    minWidth: `${560 * uiScale}px`,
                    padding: `${16 * uiScale}px`,
                }}
            >
                <div style={{ fontSize: `${15 * uiScale}px`, fontWeight: 700 }}>New Project</div>
                <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                    Create a minimal project scaffold with a manifest, intro scene, and engine config.
                </div>

                <label style={{ display: 'grid', fontSize: `${12 * uiScale}px`, gap: `${4 * uiScale}px` }}>
                    Project Name
                    <input
                        disabled={isCreating}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="My New Game"
                        style={styles.input(uiScale)}
                        value={name}
                    />
                </label>

                <label style={{ display: 'grid', fontSize: `${12 * uiScale}px`, gap: `${4 * uiScale}px` }}>
                    Author
                    <input
                        disabled={isCreating}
                        onChange={(event) => setAuthor(event.target.value)}
                        placeholder="Author"
                        style={styles.input(uiScale)}
                        value={author}
                    />
                </label>

                <label style={{ display: 'grid', fontSize: `${12 * uiScale}px`, gap: `${4 * uiScale}px` }}>
                    Project Directory
                    <div style={{ display: 'grid', gap: `${8 * uiScale}px`, gridTemplateColumns: '1fr auto' }}>
                        <input
                            disabled={isCreating}
                            onChange={(event) => setDirectory(event.target.value)}
                            placeholder="Select project directory"
                            style={styles.input(uiScale)}
                            value={directory}
                        />
                        <button
                            disabled={isCreating}
                            onClick={() => {
                                void handleBrowseDirectory();
                            }}
                            style={{ ...styles.buttonBase(uiScale) }}
                            type="button"
                        >
                            Browse...
                        </button>
                    </div>
                </label>

                <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px`, minHeight: `${16 * uiScale}px` }}>
                    {statusMessage ?? 'Choose an empty or existing directory to scaffold your project files.'}
                </div>

                <div style={{ display: 'flex', gap: `${8 * uiScale}px`, justifyContent: 'flex-end' }}>
                    <button
                        disabled={isCreating}
                        onClick={closeNewProjectModal}
                        style={{ ...styles.buttonBase(uiScale) }}
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        disabled={!canCreate}
                        onClick={() => {
                            void handleCreateProject();
                        }}
                        style={{
                            ...styles.buttonBase(uiScale),
                            background: canCreate ? t.accent.primary : t.bg.panelAlt,
                            border: 'none',
                            color: canCreate ? '#fff' : t.text.muted,
                        }}
                        type="button"
                    >
                        {isCreating ? 'Creating...' : 'Create Project'}
                    </button>
                </div>
            </div>
        </div>
    );
}

