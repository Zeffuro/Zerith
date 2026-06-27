import { CheckCircle2, FolderOpen } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useBackdropDismissal } from '../../hooks/useBackdropDismissal';
import {
    createNewProject,
    getNewProjectTemplateDefaultName,
    NEW_PROJECT_TEMPLATES,
    type NewProjectTemplateId,
} from '../../services/createNewProject';
import { fsPickDirectory } from '../../services/fs';
import { basenameFromPath, openProjectEntry } from '../../services/openProjectEntry';
import { isTauriRuntime } from '../../services/runtime/runtimeEnvironment';
import { executeOpenProjectInCurrentWindow } from '../../store/actions/projectOpenActions';
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

    const [author, setAuthor] = useState('');
    const [directory, setDirectory] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [name, setName] = useState(getNewProjectTemplateDefaultName('blank'));
    const [statusMessage, setStatusMessage] = useState<string | undefined>();
    const [templateId, setTemplateId] = useState<NewProjectTemplateId>('blank');

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setAuthor('');
        setDirectory('');
        setIsCreating(false);
        setName(getNewProjectTemplateDefaultName('blank'));
        setStatusMessage(undefined);
        setTemplateId('blank');
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
    const selectedTemplate = NEW_PROJECT_TEMPLATES.find((template) => template.id === templateId)
        ?? NEW_PROJECT_TEMPLATES[0];

    const handleSelectTemplate = (nextTemplateId: NewProjectTemplateId) => {
        if (isCreating) {
            return;
        }

        const nextTemplate = NEW_PROJECT_TEMPLATES.find((template) => template.id === nextTemplateId)
            ?? selectedTemplate;
        setTemplateId(nextTemplateId);
        setStatusMessage(undefined);

        if (!name.trim() || name === selectedTemplate.defaultName) {
            setName(nextTemplate.defaultName);
        }
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
                templateId,
            });

            const opened = await executeOpenProjectInCurrentWindow(result.manifestPath, { allowNewWindow: false });
            if (opened.status !== 'opened-current') {
                setStatusMessage('Project created, but opening it was cancelled.');
                return;
            }

            if (isTauriRuntime()) addRecentProject(result.manifestPath);
            await openInitialNewProjectEntry(result.initialEntryPath);
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
                    maxHeight: `calc(100vh - ${32 * uiScale}px)`,
                    overflow: 'auto',
                    padding: `${16 * uiScale}px`,
                    width: `min(${680 * uiScale}px, calc(100vw - ${32 * uiScale}px))`,
                }}
            >
                <div style={{ fontSize: `${15 * uiScale}px`, fontWeight: 700 }}>New Project</div>
                <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                    {selectedTemplate.description}
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

                <div style={{ display: 'grid', fontSize: `${12 * uiScale}px`, gap: `${8 * uiScale}px` }}>
                    Template
                    <div
                        aria-label="Project template"
                        role="radiogroup"
                        style={{
                            display: 'grid',
                            gap: `${8 * uiScale}px`,
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        }}
                    >
                        {NEW_PROJECT_TEMPLATES.map((template) => (
                            <button
                                aria-checked={template.id === templateId}
                                disabled={isCreating}
                                key={template.id}
                                onClick={() => handleSelectTemplate(template.id)}
                                role="radio"
                                style={{
                                    ...styles.buttonBase(uiScale),
                                    alignItems: 'stretch',
                                    background: template.id === templateId ? t.bg.panelAlt : t.bg.panel,
                                    border: `1px solid ${template.id === templateId ? t.accent.primary : t.border.normal}`,
                                    display: 'grid',
                                    gap: `${6 * uiScale}px`,
                                    justifyItems: 'stretch',
                                    padding: `${10 * uiScale}px`,
                                    textAlign: 'left',
                                }}
                                type="button"
                            >
                                <span
                                    style={{
                                        alignItems: 'center',
                                        display: 'flex',
                                        gap: `${8 * uiScale}px`,
                                        justifyContent: 'space-between',
                                    }}
                                >
                                    <span style={{ color: t.text.primary, fontWeight: 700 }}>{template.label}</span>
                                    {template.id === templateId ? (
                                        <CheckCircle2
                                            aria-hidden
                                            size={15 * uiScale}
                                            style={{ color: t.accent.primary, flex: '0 0 auto' }}
                                        />
                                    ) : (
                                        <span style={{ color: t.text.muted, fontSize: `${11 * uiScale}px` }}>
                                            {template.category}
                                        </span>
                                    )}
                                </span>
                                <span style={{ color: t.text.normal, fontSize: `${12 * uiScale}px` }}>
                                    {template.summary}
                                </span>
                                <span
                                    style={{
                                        color: t.text.muted,
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        fontSize: `${11 * uiScale}px`,
                                        gap: `${6 * uiScale}px`,
                                    }}
                                >
                                    {template.tags.map((tag) => (
                                        <span key={tag}>{tag}</span>
                                    ))}
                                </span>
                            </button>
                        ))}
                    </div>
                    <div
                        style={{
                            borderTop: `1px solid ${t.border.normal}`,
                            display: 'grid',
                            gap: `${8 * uiScale}px`,
                            paddingTop: `${8 * uiScale}px`,
                        }}
                    >
                        {selectedTemplate.readinessChecks.map((check) => (
                            <div
                                key={check.id}
                                style={{
                                    display: 'grid',
                                    gap: `${8 * uiScale}px`,
                                    gridTemplateColumns: 'auto 1fr',
                                }}
                            >
                                <CheckCircle2
                                    aria-hidden
                                    size={14 * uiScale}
                                    style={{ color: t.accent.primary, marginTop: `${1 * uiScale}px` }}
                                />
                                <div style={{ display: 'grid', gap: `${2 * uiScale}px` }}>
                                    <div style={{ color: t.text.primary, fontWeight: 700 }}>{check.label}</div>
                                    <div style={{ color: t.text.muted }}>{check.description}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

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
                            style={{
                                ...styles.buttonBase(uiScale),
                                alignItems: 'center',
                                display: 'inline-flex',
                                gap: `${6 * uiScale}px`,
                            }}
                            type="button"
                        >
                            <FolderOpen aria-hidden size={14 * uiScale} />
                            Browse...
                        </button>
                    </div>
                </label>

                <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px`, minHeight: `${16 * uiScale}px` }}>
                    {statusMessage ?? `${selectedTemplate.label} opens ${selectedTemplate.initialEntry} after creation.`}
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
                            alignItems: 'center',
                            background: canCreate ? t.accent.primary : t.bg.panelAlt,
                            border: 'none',
                            color: canCreate ? '#fff' : t.text.muted,
                            display: 'inline-flex',
                            gap: `${6 * uiScale}px`,
                        }}
                        type="button"
                    >
                        {!isCreating && <CheckCircle2 aria-hidden size={14 * uiScale} />}
                        {isCreating ? 'Creating...' : 'Create Project'}
                    </button>
                </div>
            </div>
        </div>
    );
}

async function openInitialNewProjectEntry(preferredPath?: string): Promise<void> {
    const { expandToPath, manifest, projectPath } = useProjectStore.getState();

    if (preferredPath) {
        expandToPath(preferredPath);
        await openProjectEntry(preferredPath, basenameFromPath(preferredPath), { forceView: 'timeline' });
        return;
    }

    await openInitialProjectEntryModel({
        expandToPath,
        manifest,
        openProjectEntry,
        projectPath,
    });
}
