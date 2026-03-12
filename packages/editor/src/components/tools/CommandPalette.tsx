import type { KeyboardEvent } from 'react';

import { useMemo, useState } from 'react';

import { openProjectEntry } from '../../services/openProjectEntry';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { editorTheme as t } from '../../theme/editorTheme';

type PaletteAction = {
    execute: () => Promise<void> | void;
    hint?: string;
    id: string;
    keywords: string;
    label: string;
};

type Properties = {
    onRequestClose: () => void;
    uiScale: number;
};

export function CommandPalette({ onRequestClose, uiScale }: Properties) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const activeFile = useProjectStore((state) => state.activeFile);
    const openProjectFromManifest = useProjectStore((state) => state.openProjectFromManifest);
    const saveActiveFileFromCurrentScript = useProjectStore((state) => state.saveActiveFileFromCurrentScript);
    const saveAllDirtyFiles = useProjectStore((state) => state.saveAllDirtyFiles);

    const autosaveEnabled = useEditorStore((state) => state.autosaveEnabled);
    const clearAllBreakpoints = useEditorStore((state) => state.clearAllBreakpoints);
    const isPlaybackPaused = useEditorStore((state) => state.isPlaybackPaused);
    const openGlobalSearchPopup = useEditorStore((state) => state.openGlobalSearchPopup);
    const openGlobalSearchReplacePopup = useEditorStore((state) => state.openGlobalSearchReplacePopup);
    const recentProjects = useEditorStore((state) => state.recentProjects);
    const resetDockLayout = useEditorStore((state) => state.resetDockLayout);
    const setAutosaveEnabled = useEditorStore((state) => state.setAutosaveEnabled);
    const setThemeKey = useEditorStore((state) => state.setThemeKey);
    const toggleMute = useEditorStore((state) => state.toggleMute);
    const triggerPause = useEditorStore((state) => state.triggerPause);
    const triggerPlay = useEditorStore((state) => state.triggerPlay);
    const triggerResume = useEditorStore((state) => state.triggerResume);
    const triggerStep = useEditorStore((state) => state.triggerStep);
    const triggerStop = useEditorStore((state) => state.triggerStop);

    const playTrigger = useEditorStore((state) => state.playTrigger);
    const stopTrigger = useEditorStore((state) => state.stopTrigger);

    const isRunning = playTrigger > stopTrigger;
    const safeRecentProjects = useMemo(() => recentProjects ?? [], [recentProjects]);

    const actions = useMemo<PaletteAction[]>(() => {
        const baseActions: PaletteAction[] = [
            {
                execute: () => {
                    openGlobalSearchPopup('find');
                },
                hint: 'Ctrl+Shift+F',
                id: 'find-project',
                keywords: 'find search project global',
                label: 'Find in Project',
            },
            {
                execute: () => {
                    openGlobalSearchReplacePopup();
                },
                hint: 'Ctrl+Shift+G',
                id: 'replace-project',
                keywords: 'find replace all project global',
                label: 'Find and Replace in Project',
            },
            {
                execute: async () => {
                    if (!activeFile) return;
                    useEditorStore.getState().markManualSave();
                    await saveActiveFileFromCurrentScript();
                },
                hint: 'Ctrl+S',
                id: 'save',
                keywords: 'save file write',
                label: 'Save Active File',
            },
            {
                execute: async () => {
                    useEditorStore.getState().markManualSave();
                    await saveAllDirtyFiles();
                },
                hint: 'Ctrl+Shift+S',
                id: 'save-all',
                keywords: 'save all files write',
                label: 'Save All Dirty Files',
            },
            {
                execute: () => {
                    setAutosaveEnabled(!autosaveEnabled);
                },
                id: 'toggle-autosave',
                keywords: 'autosave save interval',
                label: `Autosave: ${autosaveEnabled ? 'Disable' : 'Enable'}`,
            },
            {
                execute: () => {
                    triggerPlay();
                },
                hint: 'F5',
                id: 'playback-play',
                keywords: 'play preview run start',
                label: 'Playback: Play',
            },
            {
                execute: () => {
                    triggerStop();
                },
                hint: 'Shift+F5',
                id: 'playback-stop',
                keywords: 'stop preview playback',
                label: 'Playback: Stop',
            },
            {
                execute: () => {
                    if (!isRunning || isPlaybackPaused) return;
                    triggerPause();
                },
                hint: 'F6',
                id: 'playback-pause',
                keywords: 'pause preview playback',
                label: 'Playback: Pause',
            },
            {
                execute: () => {
                    if (!isRunning || !isPlaybackPaused) return;
                    triggerResume();
                },
                hint: 'F5',
                id: 'playback-resume',
                keywords: 'resume continue preview playback',
                label: 'Playback: Resume',
            },
            {
                execute: () => {
                    if (!isRunning || !isPlaybackPaused) return;
                    triggerStep();
                },
                hint: 'F10',
                id: 'playback-step',
                keywords: 'step over debug playback',
                label: 'Playback: Step Over',
            },
            {
                execute: () => {
                    clearAllBreakpoints();
                },
                id: 'clear-breakpoints',
                keywords: 'breakpoints clear debug',
                label: 'Debug: Clear All Breakpoints',
            },
            {
                execute: () => {
                    resetDockLayout();
                },
                id: 'reset-layout',
                keywords: 'layout reset panels dock',
                label: 'Reset Layout',
            },
            {
                execute: () => {
                    toggleMute();
                },
                id: 'toggle-mute',
                keywords: 'mute audio sound',
                label: 'Toggle Mute',
            },
            {
                execute: () => {
                    setThemeKey('classic');
                },
                id: 'theme-classic',
                keywords: 'theme classic',
                label: 'Theme: Classic',
            },
            {
                execute: () => {
                    setThemeKey('classicSoft');
                },
                id: 'theme-classic-soft',
                keywords: 'theme classic soft',
                label: 'Theme: Classic Soft',
            },
        ];

        const recentProjectActions = safeRecentProjects.map((project) => ({
            execute: async () => {
                await openProjectFromManifest(project.path);
                useEditorStore.getState().addRecentProject(project.path);
                await openInitialProjectEntry();
            },
            id: `open-recent-${project.path}`,
            keywords: `open recent project ${project.name} ${project.path}`,
            label: `Open Recent: ${project.name}`,
        }));

        return [...baseActions, ...recentProjectActions];
    }, [activeFile, autosaveEnabled, clearAllBreakpoints, isPlaybackPaused, isRunning, openGlobalSearchPopup, openGlobalSearchReplacePopup, openProjectFromManifest, resetDockLayout, safeRecentProjects, saveActiveFileFromCurrentScript, saveAllDirtyFiles, setAutosaveEnabled, setThemeKey, toggleMute, triggerPause, triggerPlay, triggerResume, triggerStep, triggerStop]);

    const filteredActions = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (normalizedQuery.length === 0) return actions;

        return actions.filter((action) => {
            const haystack = `${action.label} ${action.keywords}`.toLowerCase();
            return haystack.includes(normalizedQuery);
        });
    }, [actions, query]);

    const executeSelected = async (index: number) => {
        const selected = filteredActions[index];
        if (!selected) return;
        await selected.execute();
        onRequestClose();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSelectedIndex((current) => Math.min(filteredActions.length - 1, current + 1));
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSelectedIndex((current) => Math.max(0, current - 1));
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            void executeSelected(selectedIndex);
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            onRequestClose();
        }
    };

    return (
        <div
            onClick={onRequestClose}
            style={{
                alignItems: 'flex-start',
                background: 'rgba(0, 0, 0, 0.45)',
                display: 'flex',
                height: '100%',
                justifyContent: 'center',
                left: 0,
                position: 'absolute',
                top: 0,
                width: '100%',
                zIndex: 5200,
            }}
        >
            <div
                onClick={(event) => event.stopPropagation()}
                style={{
                    background: t.bg.popup,
                    border: `1px solid ${t.border.normal}`,
                    borderRadius: t.radius.md,
                    boxShadow: t.shadow.popupStrong,
                    marginTop: `${52 * uiScale}px`,
                    maxHeight: `min(70vh, ${560 * uiScale}px)`,
                    maxWidth: `min(92vw, ${820 * uiScale}px)`,
                    overflow: 'hidden',
                    width: `min(92vw, ${680 * uiScale}px)`,
                }}
            >
                <input
                    autoFocus
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setSelectedIndex(0);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Type an action (e.g. Save All, Play, Reset Layout)"
                    style={{
                        background: t.bg.panel,
                        border: 'none',
                        borderBottom: `1px solid ${t.border.subtle}`,
                        color: t.text.normal,
                        fontSize: `${13 * uiScale}px`,
                        outline: 'none',
                        padding: `${10 * uiScale}px ${12 * uiScale}px`,
                        width: '100%',
                    }}
                    value={query}
                />

                <div className="zerith-scrollbar" style={{ maxHeight: `min(60vh, ${500 * uiScale}px)`, overflowY: 'auto' }}>
                    {filteredActions.length === 0 && (
                        <div style={{ color: t.text.faint, fontStyle: 'italic', padding: `${10 * uiScale}px ${12 * uiScale}px` }}>
                            No matching commands
                        </div>
                    )}

                    {filteredActions.map((action, index) => {
                        const active = selectedIndex === index;
                        return (
                            <button
                                key={action.id}
                                onClick={() => {
                                    void executeSelected(index);
                                }}
                                style={{
                                    alignItems: 'center',
                                    background: active ? t.bg.selected : 'transparent',
                                    border: 'none',
                                    color: active ? t.text.primary : t.text.normal,
                                    cursor: 'pointer',
                                    display: 'grid',
                                    gap: `${10 * uiScale}px`,
                                    gridTemplateColumns: '1fr auto',
                                    padding: `${8 * uiScale}px ${12 * uiScale}px`,
                                    textAlign: 'left',
                                    width: '100%',
                                }}
                                type="button"
                            >
                                <span>{action.label}</span>
                                <span style={{ color: t.text.muted, fontSize: `${11 * uiScale}px` }}>{action.hint ?? ''}</span>
                            </button>
                        );
                    })}
                </div>

                <div style={{ borderTop: `1px solid ${t.border.subtle}`, color: t.text.muted, fontSize: `${11 * uiScale}px`, padding: `${8 * uiScale}px ${12 * uiScale}px` }}>
                    Enter to run • Esc to close • Up/Down to navigate
                </div>
            </div>
        </div>
    );
}

function basename(path: string): string {
    return path.split(/[\\/]/).pop() || path;
}

async function openInitialProjectEntry(): Promise<void> {
    const { expandToPath, manifest, projectPath } = useProjectStore.getState();
    if (!projectPath) return;

    const startSceneName = manifest?.startScene;
    const sceneEntry = startSceneName ? manifest?.scenes?.[startSceneName] : undefined;
    if (typeof sceneEntry === 'string') {
        const scenePath = resolveProjectPath(projectPath, sceneEntry);
        expandToPath(scenePath);
        await openProjectEntry(scenePath, basename(scenePath));
        return;
    }

    const gameManifestPath = `${projectPath}/game.json`;
    expandToPath(gameManifestPath);
    await openProjectEntry(gameManifestPath, 'game.json');
}

function resolveProjectPath(projectPath: string, targetPath: string): string {
    if (targetPath.startsWith('/') || targetPath.startsWith('\\')) {
        return `${projectPath}${targetPath}`;
    }
    return `${projectPath}/${targetPath}`;
}

