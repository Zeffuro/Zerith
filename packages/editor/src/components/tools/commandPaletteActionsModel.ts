export type CommandPaletteActionDeps = {
    activeDockLayoutPresetId: string | undefined;
    activeFile: string | undefined;
            addRecentProject: (manifestPath: string) => void;
            availableThemeKeys: string[];
    captureDockLayoutJson: () => unknown;
    clearAllBreakpoints: () => void;
    closeProject: () => void;
    deleteDockLayoutPreset: (id: string) => void;
    dockLayoutPresets: Array<{ id: string; layoutJson: unknown; name: string; }>;
    isPlaybackPaused: boolean;
    isRunning: boolean;
    markManualSave: () => void;
    openExportGameModal: () => void;
    openGlobalSearchPopup: (mode?: 'find' | 'replace') => void;
    openGlobalSearchReplacePopup: () => void;
    openInitialProjectEntry: () => Promise<void>;
    openNewProjectModal: () => void;
    openProjectFolder: () => Promise<void>;
    openProjectFromManifest: (manifestPath: string) => Promise<void>;
    openSettingsModal: () => void;
            projectPath: string | undefined;
            recentProjects: RecentProjectLike[] | undefined;
            resetDockLayout: () => void;
    saveActiveFileFromCurrentScript: () => Promise<unknown>;
    saveAllDirtyFiles: () => Promise<unknown>;
    saveDockLayoutPreset: (name: string, layoutJson: unknown) => void;
    saveProjectAs: () => Promise<void>;
    setActiveDockLayoutPresetId: (id: string | undefined) => void;
    setDockLayoutJson: (json: unknown) => void;
    setThemeKey: (key: string) => void;
    themeKey: string;
    triggerPause: () => void;
    triggerPlay: () => void;
    triggerResume: () => void;
    triggerStep: () => void;
    triggerStop: () => void;
};

export type PaletteAction = {
    action: () => Promise<void> | void;
    id: string;
    keywords: string;
    label: string;
    shortcut?: string;
};

type RecentProjectLike = {
    name: string;
    path: string;
};

export function buildBasePaletteActions(deps: CommandPaletteActionDeps): PaletteAction[] {
    return [
        {
            action: () => {
                deps.openGlobalSearchPopup('find');
            },
            id: 'find-project',
            keywords: 'find search project global',
            label: 'Find in Project',
            shortcut: 'Ctrl+Shift+F',
        },
        {
            action: () => {
                deps.openGlobalSearchReplacePopup();
            },
            id: 'replace-project',
            keywords: 'find replace all project global',
            label: 'Find and Replace in Project',
            shortcut: 'Ctrl+Shift+G',
        },
        {
            action: async () => {
                if (!deps.activeFile) return;
                deps.markManualSave();
                await deps.saveActiveFileFromCurrentScript();
            },
            id: 'save',
            keywords: 'save file write',
            label: 'Save Active File',
            shortcut: 'Ctrl+S',
        },
        {
            action: async () => {
                deps.markManualSave();
                await deps.saveAllDirtyFiles();
            },
            id: 'save-all',
            keywords: 'save all files write',
            label: 'Save All Files',
            shortcut: 'Ctrl+Shift+S',
        },
        {
            action: async () => {
                await deps.saveProjectAs();
            },
            id: 'save-project-as',
            keywords: 'save project as duplicate clone workspace',
            label: 'Save Project As...',
            shortcut: 'Ctrl+Alt+Shift+S',
        },
        {
            action: () => {
                deps.openNewProjectModal();
            },
            id: 'new-project',
            keywords: 'new project create scaffold',
            label: 'New Project...',
            shortcut: 'Ctrl+Shift+N',
        },
        {
            action: () => {
                if (!deps.projectPath) return;
                deps.openExportGameModal();
            },
            id: 'export-game',
            keywords: 'export game build package zip',
            label: 'Export Game...',
        },
        {
            action: async () => {
                if (!deps.projectPath) return;
                await deps.openProjectFolder();
            },
            id: 'open-project-folder',
            keywords: 'open project folder explorer shell reveal',
            label: 'Open Project Folder',
            shortcut: 'Ctrl+Alt+O',
        },
        {
            action: () => {
                const nextThemeKey = resolveNextThemeKey(deps.themeKey, deps.availableThemeKeys);
                deps.setThemeKey(nextThemeKey);
            },
            id: 'toggle-theme',
            keywords: 'toggle switch cycle theme appearance',
            label: 'Toggle Theme',
            shortcut: 'Ctrl+Alt+T',
        },
        {
            action: () => {
                deps.closeProject();
            },
            id: 'close-project',
            keywords: 'close unload project workspace',
            label: 'Close Project',
        },
        {
            action: () => {
                deps.openSettingsModal();
            },
            id: 'open-settings',
            keywords: 'settings preferences keymap theme autosave',
            label: 'Open Settings',
            shortcut: 'Ctrl+Alt+S',
        },
        {
            action: () => {
                deps.triggerPlay();
            },
            id: 'playback-play',
            keywords: 'play preview run start',
            label: 'Playback: Play',
            shortcut: 'F5',
        },
        {
            action: () => {
                deps.triggerStop();
            },
            id: 'playback-stop',
            keywords: 'stop preview playback',
            label: 'Playback: Stop',
            shortcut: 'Shift+F5',
        },
        {
            action: () => {
                if (!deps.isRunning || deps.isPlaybackPaused) return;
                deps.triggerPause();
            },
            id: 'playback-pause',
            keywords: 'pause preview playback',
            label: 'Playback: Pause',
            shortcut: 'F6',
        },
        {
            action: () => {
                if (!deps.isRunning || !deps.isPlaybackPaused) return;
                deps.triggerResume();
            },
            id: 'playback-resume',
            keywords: 'resume continue preview playback',
            label: 'Playback: Resume',
            shortcut: 'F5',
        },
        {
            action: () => {
                if (!deps.isRunning || !deps.isPlaybackPaused) return;
                deps.triggerStep();
            },
            id: 'playback-step',
            keywords: 'step over debug playback',
            label: 'Playback: Step Over',
            shortcut: 'F10',
        },
        {
            action: () => {
                deps.clearAllBreakpoints();
            },
            id: 'clear-breakpoints',
            keywords: 'breakpoints clear debug',
            label: 'Debug: Clear All Breakpoints',
        },
        {
            action: () => {
                deps.resetDockLayout();
                deps.setActiveDockLayoutPresetId(undefined);
            },
            id: 'reset-layout',
            keywords: 'layout reset panels dock',
            label: 'Reset Layout',
        },
        {
            action: () => {
                const promptForName = globalThis.prompt;
                if (typeof promptForName !== 'function') return;
                const layoutName = promptForName('Save current layout as preset', 'My Layout')?.trim();
                if (!layoutName) return;
                deps.saveDockLayoutPreset(layoutName, deps.captureDockLayoutJson());
            },
            id: 'save-layout-preset',
            keywords: 'layout save preset dock panels',
            label: 'Save Layout Preset...',
        },
        ...deps.dockLayoutPresets.map((preset) => ({
            action: () => {
                deps.setDockLayoutJson(preset.layoutJson);
                deps.setActiveDockLayoutPresetId(preset.id);
            },
            id: `load-layout-${preset.id}`,
            keywords: `layout load preset dock ${preset.name}`,
            label: `Load Layout: ${preset.name}${deps.activeDockLayoutPresetId === preset.id ? ' (Active)' : ''}`,
        })),
        ...deps.dockLayoutPresets.map((preset) => ({
            action: () => {
                deps.deleteDockLayoutPreset(preset.id);
            },
            id: `delete-layout-${preset.id}`,
            keywords: `layout delete preset dock ${preset.name}`,
            label: `Delete Layout Preset: ${preset.name}`,
        })),
    ];
}

export function buildCommandPaletteActions(deps: CommandPaletteActionDeps): PaletteAction[] {
    return [
        ...buildBasePaletteActions(deps),
        ...buildRecentProjectPaletteActions(deps),
    ];
}

export function buildRecentProjectPaletteActions(deps: CommandPaletteActionDeps): PaletteAction[] {
    return (deps.recentProjects ?? []).map((project) => ({
        action: async () => {
            await executeRecentProjectOpenSequence(project.path, deps);
        },
        id: `open-recent-${project.path}`,
        keywords: `open recent project ${project.name} ${project.path}`,
        label: `Open Recent: ${project.name}`,
    }));
}

export async function executeRecentProjectOpenSequence(
    projectPath: string,
    deps: Pick<CommandPaletteActionDeps, 'addRecentProject' | 'openInitialProjectEntry' | 'openProjectFromManifest'>,
): Promise<void> {
    await deps.openProjectFromManifest(projectPath);
    deps.addRecentProject(projectPath);
    await deps.openInitialProjectEntry();
}

function resolveNextThemeKey(currentThemeKey: string, availableThemeKeys: string[]): string {
    if (availableThemeKeys.length === 0) return 'classic';

    const currentIndex = availableThemeKeys.indexOf(currentThemeKey);
    if (currentIndex === -1) return availableThemeKeys[0];
    return availableThemeKeys[(currentIndex + 1) % availableThemeKeys.length];
}

