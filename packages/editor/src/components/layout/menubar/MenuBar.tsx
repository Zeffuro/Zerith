import { getCurrentWindow } from '@tauri-apps/api/window';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useDismissiblePopup } from '../../../hooks/useDismissiblePopup';
import { openProjectEntry } from '../../../services/openProjectEntry';
import { saveProjectAs } from '../../../services/saveProjectAs';
import { executeCloseProjectAction } from '../../../store/actions/projectOpenActions';
import { useProjectStore } from '../../../store/storeBootstrap';
import { useScriptStore } from '../../../store/storeBootstrap';
import { useEditorStore } from '../../../store/useEditorStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { editorTheme as t } from '../../../theme/editorTheme';
import { openInitialProjectEntry as openInitialProjectEntryModel } from '../../tools/commandPaletteModel';
import { MenuButton } from './MenuButton';
import { MenuDropdown, type MenuItem } from './MenuDropdown';

const REPOSITORY_URL = 'https://github.com/Zeffuro/Zerith';

type MenuKey = 'Debug' | 'Edit' | 'File' | 'Help' | 'Run' | 'View';

export function MenuBar({ uiScale }: { uiScale: number }) {
    const rootReference = useRef<HTMLDivElement>(null);
    const [openMenu, setOpenMenu] = useState<MenuKey | undefined>();

    const {
        addRecentProject,
        captureDockLayoutJson,
        clearAllBreakpoints,
        clearRecentProjects,
        isPlaybackPaused,
        markManualSave,
        openCommandPalette,
        openExportGameModal,
        openGlobalSearchPopup,
        openGlobalSearchReplacePopup,
        openNewProjectModal,
        openSettingsModal,
        playTrigger,
        resetDockLayout,
        setDockLayoutJson,
        setUiScale,
        stopTrigger,
        toggleBreakpoint,
        triggerPause,
        triggerPlay,
        triggerResume,
        triggerStep,
        triggerStop,
        uiScale: currentScale,
    } = useEditorStore();
    const recentProjects = useSettingsStore((state) => state.recentProjects);
    const activeDockLayoutPresetId = useSettingsStore((state) => state.activeDockLayoutPresetId);
    const deleteDockLayoutPreset = useSettingsStore((state) => state.deleteDockLayoutPreset);
    const dockLayoutPresets = useSettingsStore((state) => state.dockLayoutPresets);
    const saveDockLayoutPreset = useSettingsStore((state) => state.saveDockLayoutPreset);
    const setActiveDockLayoutPresetId = useSettingsStore((state) => state.setActiveDockLayoutPresetId);

    const {
        activeFile,
        dirtyFiles,
        openProjectFromManifest,
        projectPath,
        saveActiveFileFromCurrentScript,
        saveAllDirtyFiles,
    } = useProjectStore();

    const handleOpenInitialProjectEntry = useCallback(async () => {
        const { expandToPath, manifest, projectPath: currentProjectPath } = useProjectStore.getState();
        await openInitialProjectEntryModel({
            expandToPath,
            manifest,
            openProjectEntry,
            projectPath: currentProjectPath,
        });
    }, []);

    const selectedNodePaths = useEditorStore((state) => state.selectedNodePaths);
    const canRedo = useScriptStore((state) => state.future.length > 0);
    const canUndo = useScriptStore((state) => state.past.length > 0);
    const redo = useScriptStore((state) => state.redo);
    const undo = useScriptStore((state) => state.undo);

    useDismissiblePopup(!!openMenu, rootReference, () => setOpenMenu(undefined));

    const handleOpenProject = useCallback(async () => {
        try {
            const selectedFile = await openDialog({
                directory: false,
                filters: [{ extensions: ['json'], name: 'Game Manifest' }],
                multiple: false,
                title: 'Select game.json',
            });

            if (selectedFile) {
                await openProjectFromManifest(selectedFile);
                addRecentProject(selectedFile);
                await handleOpenInitialProjectEntry();
            }
        } catch (error) {
            console.error('Failed to open project dialog:', error);
        }
    }, [addRecentProject, handleOpenInitialProjectEntry, openProjectFromManifest]);

    const handleOpenRecentProject = useCallback(async (manifestPath: string) => {
        try {
            await openProjectFromManifest(manifestPath);
            addRecentProject(manifestPath);
            await handleOpenInitialProjectEntry();
        } catch (error) {
            console.error('Failed to open recent project:', error);
        }
    }, [addRecentProject, handleOpenInitialProjectEntry, openProjectFromManifest]);

    const handleSave = useCallback(async () => {
        if (!activeFile) return;
        markManualSave();
        await saveActiveFileFromCurrentScript();
    }, [activeFile, markManualSave, saveActiveFileFromCurrentScript]);

    const handleSaveAll = useCallback(async () => {
        markManualSave();
        await saveAllDirtyFiles();
    }, [markManualSave, saveAllDirtyFiles]);

    const handleSaveProjectAs = useCallback(async () => {
        if (!projectPath) return;

        try {
            markManualSave();
            await saveAllDirtyFiles();

            const result = await saveProjectAs(projectPath);
            if (!result) return;

            await openProjectFromManifest(result.manifestPath);
            addRecentProject(result.manifestPath);
            await handleOpenInitialProjectEntry();
        } catch (error) {
            console.error('Failed to save project as:', error);
        }
    }, [
        addRecentProject,
        handleOpenInitialProjectEntry,
        markManualSave,
        openProjectFromManifest,
        projectPath,
        saveAllDirtyFiles,
    ]);

    const handleExit = useCallback(() => {
        void getCurrentWindow().close();
    }, []);

    const handleOpenRepository = useCallback(async () => {
        try {
            await openUrl(REPOSITORY_URL);
            return;
        } catch {
            // Fall back for non-Tauri web contexts.
        }

        globalThis.open?.(REPOSITORY_URL, '_blank');
    }, []);

    const isRunning = playTrigger > stopTrigger;
            const handleSaveLayoutPreset = useCallback(() => {
                const layoutName = globalThis.prompt('Save current layout as preset', 'My Layout')?.trim();
                if (!layoutName) return;
                const layoutJson = captureDockLayoutJson();
                if (!layoutJson || typeof layoutJson !== 'object') return;
                saveDockLayoutPreset(layoutName, layoutJson);
            }, [captureDockLayoutJson, saveDockLayoutPreset]);

            const handleLoadLayoutPreset = useCallback((presetId: string) => {
                const preset = dockLayoutPresets.find((entry) => entry.id === presetId);
                if (!preset) return;
                setDockLayoutJson(preset.layoutJson);
                setActiveDockLayoutPresetId(preset.id);
            }, [dockLayoutPresets, setActiveDockLayoutPresetId, setDockLayoutJson]);

            const handleResetLayout = useCallback(() => {
                resetDockLayout();
                setActiveDockLayoutPresetId(undefined);
            }, [resetDockLayout, setActiveDockLayoutPresetId]);

    const selectedRootIndex = selectedNodePaths[0]?.length === 1
        && typeof selectedNodePaths[0][0] === 'number'
        ? selectedNodePaths[0][0]
        : undefined;

    const fileItems: MenuItem[] = (() => {
        const hasDirtyFiles = dirtyFiles.size > 0;
        const safeRecentProjects = recentProjects ?? [];
        const openRecentItems: MenuItem[] = safeRecentProjects.length === 0
            ? [{ disabled: true, label: 'No recent projects' }]
            : safeRecentProjects.map((project) => ({
                label: `${project.name} - ${project.path}`,
                onClick: () => { void handleOpenRecentProject(project.path); },
            }));

        const openRecentChildren: MenuItem[] = safeRecentProjects.length === 0
            ? openRecentItems
            : [
                ...openRecentItems,
                { label: 'sep-recent-clear', separator: true },
                { label: 'Clear Recent Projects', onClick: clearRecentProjects },
            ];

        return [
            { label: 'New Project…', onClick: openNewProjectModal, shortcut: 'Ctrl+Shift+N' },
            { label: 'Open Project…', onClick: () => { void handleOpenProject(); }, shortcut: 'Ctrl+O' },
            { children: openRecentChildren, label: `Open Recent (${safeRecentProjects.length})` },
            { label: 'sep-0', separator: true },
            { disabled: !activeFile, label: 'Save', onClick: () => { void handleSave(); }, shortcut: 'Ctrl+S' },
            { disabled: !hasDirtyFiles, label: 'Save All', onClick: () => { void handleSaveAll(); }, shortcut: 'Ctrl+Shift+S' },
            {
                disabled: !projectPath,
                label: 'Save Project As...',
                onClick: () => { void handleSaveProjectAs(); },
                shortcut: 'Ctrl+Alt+Shift+S',
            },
            { disabled: !projectPath, label: 'Close Project', onClick: executeCloseProjectAction },
            { label: 'sep-1', separator: true },
            { label: 'Settings…', onClick: openSettingsModal, shortcut: 'Ctrl+Alt+S' },
            { label: 'sep-1a', separator: true },
            { disabled: !projectPath, label: 'Export Game…', onClick: openExportGameModal },
            { label: 'sep-1b', separator: true },
            { label: 'Reset Layout', onClick: handleResetLayout },
            { label: 'sep-1c', separator: true },
            { label: 'Exit', onClick: handleExit },
        ];
    })();

    const editItems = useMemo<MenuItem[]>(
        () =>[
            { disabled: !canUndo, label: 'Undo', onClick: undo, shortcut: 'Ctrl+Z' },
            { disabled: !canRedo, label: 'Redo', onClick: redo, shortcut: 'Ctrl+Y' },
            { label: 'sep-2', separator: true },
            { disabled: false, label: 'Copy', shortcut: 'Ctrl+C' },
            { disabled: false, label: 'Paste', shortcut: 'Ctrl+V' },
        ],[canRedo, canUndo, redo, undo]
    );

    const viewItems = useMemo<MenuItem[]>(
        () =>[
            { label: 'Find in Project…', onClick: openGlobalSearchPopup, shortcut: 'Ctrl+Shift+F' },
            { label: 'Find and Replace in Project…', onClick: openGlobalSearchReplacePopup, shortcut: 'Ctrl+Shift+G' },
            { label: 'Command Palette…', onClick: openCommandPalette, shortcut: 'Ctrl+Shift+P' },
            { label: 'sep-3', separator: true },
            { label: 'Save Layout Preset…', onClick: handleSaveLayoutPreset },
            {
                children: dockLayoutPresets.length === 0
                    ? [{ disabled: true, label: 'No saved presets' }]
                    : dockLayoutPresets.map((preset) => ({
                        label: preset.id === activeDockLayoutPresetId ? `${preset.name} (Active)` : preset.name,
                        onClick: () => handleLoadLayoutPreset(preset.id),
                    })),
                label: 'Load Layout Preset',
            },
            {
                children: dockLayoutPresets.length === 0
                    ? [{ disabled: true, label: 'No saved presets' }]
                    : dockLayoutPresets.map((preset) => ({
                        danger: true,
                        label: preset.name,
                        onClick: () => deleteDockLayoutPreset(preset.id),
                    })),
                label: 'Delete Layout Preset',
            },
            { label: 'Reset Layout to Default', onClick: handleResetLayout },
            { label: 'sep-3a', separator: true },
            { label: 'Zoom In', onClick: () => setUiScale(Math.min(1.5, currentScale + 0.1)), shortcut: 'Ctrl+=' },
            { label: 'Zoom Out', onClick: () => setUiScale(Math.max(0.8, currentScale - 0.1)), shortcut: 'Ctrl+-' },
            { label: 'Reset Zoom', onClick: () => setUiScale(1), shortcut: 'Ctrl+0' },
        ],
        [
            activeDockLayoutPresetId,
            currentScale,
            deleteDockLayoutPreset,
            dockLayoutPresets,
            handleLoadLayoutPreset,
            handleResetLayout,
            handleSaveLayoutPreset,
            openCommandPalette,
            openGlobalSearchPopup,
            openGlobalSearchReplacePopup,
            setUiScale,
        ]
    );

    const runItems = useMemo<MenuItem[]>(
        () =>[
            { label: 'Play', onClick: triggerPlay },
            { label: 'Stop', onClick: triggerStop, shortcut: 'Shift+F5' },
        ],
        [triggerPlay, triggerStop]
    );

    const debugItems: MenuItem[] = [
        {
            disabled: !isRunning || !isPlaybackPaused,
            label: 'Continue',
            onClick: triggerResume,
            shortcut: 'F5',
        },
        {
            disabled: !isRunning || isPlaybackPaused,
            label: 'Pause',
            onClick: triggerPause,
            shortcut: 'F6',
        },
        {
            disabled: !isRunning || !isPlaybackPaused,
            label: 'Step Over',
            onClick: triggerStep,
            shortcut: 'F10',
        },
        {
            disabled: true,
            label: 'Step Into',
            shortcut: 'F11',
        },
        {
            disabled: true,
            label: 'Step Out',
            shortcut: 'Shift+F11',
        },
        {
            disabled: !activeFile || selectedRootIndex === undefined,
            label: 'Toggle Breakpoint',
            onClick: () => {
                if (!activeFile || selectedRootIndex === undefined) return;
                toggleBreakpoint(activeFile, selectedRootIndex);
            },
            shortcut: 'F9',
        },
        { label: 'Clear All Breakpoints', onClick: clearAllBreakpoints },
        { label: 'sep-debug-1', separator: true },
        { label: 'Start Playback', onClick: triggerPlay },
        { disabled: !isRunning, label: 'Stop Playback', onClick: triggerStop, shortcut: 'Shift+F5' },
    ];

    const helpItems = useMemo<MenuItem[]>(
        () =>[
            { label: 'GitHub Repository', onClick: () => { void handleOpenRepository(); } },
            { disabled: true, label: 'About Zerith Editor' },
        ],
        [handleOpenRepository]
    );

    const menuMap: Record<MenuKey, MenuItem[]> = {
        Debug: debugItems,
        Edit: editItems,
        File: fileItems,
        Help: helpItems,
        Run: runItems,
        View: viewItems,
    };

    const keys: MenuKey[] =['File', 'Edit', 'View', 'Run', 'Debug', 'Help'];

    return (
        <div
            ref={rootReference}
            style={{
                alignItems: 'center',
                background: t.bg.panelAlt,
                borderBottom: `1px solid ${t.border.subtle}`,
                display: 'flex',
                gap: `${2 * uiScale}px`,
                height: `${28 * uiScale}px`,
                minHeight: `${28 * uiScale}px`,
                padding: `0 ${8 * uiScale}px`,
                position: 'relative',
                zIndex: 3000,
            }}
        >
            {keys.map((k) => (
                <MenuButton
                    active={openMenu === k}
                    key={k}
                    label={k}
                    onClick={() => setOpenMenu((previous) => (previous === k ? undefined : k))}
                    onMouseEnter={() => {
                        setOpenMenu((current) => (current && current !== k ? k : current));
                    }}
                    uiScale={uiScale}
                >
                    <MenuDropdown
                        items={menuMap[k]}
                        onItemSelected={() => setOpenMenu(undefined)}
                        uiScale={uiScale}
                    />
                </MenuButton>
            ))}
        </div>
    );
}


