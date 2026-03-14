export type CommandPaletteActionDeps = {
    activeFile: string | undefined;
    addRecentProject: (manifestPath: string) => void;
    clearAllBreakpoints: () => void;
    isPlaybackPaused: boolean;
    isRunning: boolean;
    markManualSave: () => void;
    openGlobalSearchPopup: (mode?: 'find' | 'replace') => void;
    openGlobalSearchReplacePopup: () => void;
    openInitialProjectEntry: () => Promise<void>;
    openProjectFromManifest: (manifestPath: string) => Promise<void>;
    openSettingsModal: () => void;
    recentProjects: RecentProjectLike[] | undefined;
    resetDockLayout: () => void;
    saveActiveFileFromCurrentScript: () => Promise<unknown>;
    saveAllDirtyFiles: () => Promise<unknown>;
    triggerPause: () => void;
    triggerPlay: () => void;
    triggerResume: () => void;
    triggerStep: () => void;
    triggerStop: () => void;
};

export type PaletteAction = {
    execute: () => Promise<void> | void;
    hint?: string;
    id: string;
    keywords: string;
    label: string;
};

type RecentProjectLike = {
    name: string;
    path: string;
};

export function buildBasePaletteActions(deps: CommandPaletteActionDeps): PaletteAction[] {
    return [
        {
            execute: () => {
                deps.openGlobalSearchPopup('find');
            },
            hint: 'Ctrl+Shift+F',
            id: 'find-project',
            keywords: 'find search project global',
            label: 'Find in Project',
        },
        {
            execute: () => {
                deps.openGlobalSearchReplacePopup();
            },
            hint: 'Ctrl+Shift+G',
            id: 'replace-project',
            keywords: 'find replace all project global',
            label: 'Find and Replace in Project',
        },
        {
            execute: async () => {
                if (!deps.activeFile) return;
                deps.markManualSave();
                await deps.saveActiveFileFromCurrentScript();
            },
            hint: 'Ctrl+S',
            id: 'save',
            keywords: 'save file write',
            label: 'Save Active File',
        },
        {
            execute: async () => {
                deps.markManualSave();
                await deps.saveAllDirtyFiles();
            },
            hint: 'Ctrl+Shift+S',
            id: 'save-all',
            keywords: 'save all files write',
            label: 'Save All Dirty Files',
        },
        {
            execute: () => {
                deps.openSettingsModal();
            },
            hint: 'Ctrl+Alt+S',
            id: 'open-settings',
            keywords: 'settings preferences keymap theme autosave',
            label: 'Open Settings',
        },
        {
            execute: () => {
                deps.triggerPlay();
            },
            hint: 'F5',
            id: 'playback-play',
            keywords: 'play preview run start',
            label: 'Playback: Play',
        },
        {
            execute: () => {
                deps.triggerStop();
            },
            hint: 'Shift+F5',
            id: 'playback-stop',
            keywords: 'stop preview playback',
            label: 'Playback: Stop',
        },
        {
            execute: () => {
                if (!deps.isRunning || deps.isPlaybackPaused) return;
                deps.triggerPause();
            },
            hint: 'F6',
            id: 'playback-pause',
            keywords: 'pause preview playback',
            label: 'Playback: Pause',
        },
        {
            execute: () => {
                if (!deps.isRunning || !deps.isPlaybackPaused) return;
                deps.triggerResume();
            },
            hint: 'F5',
            id: 'playback-resume',
            keywords: 'resume continue preview playback',
            label: 'Playback: Resume',
        },
        {
            execute: () => {
                if (!deps.isRunning || !deps.isPlaybackPaused) return;
                deps.triggerStep();
            },
            hint: 'F10',
            id: 'playback-step',
            keywords: 'step over debug playback',
            label: 'Playback: Step Over',
        },
        {
            execute: () => {
                deps.clearAllBreakpoints();
            },
            id: 'clear-breakpoints',
            keywords: 'breakpoints clear debug',
            label: 'Debug: Clear All Breakpoints',
        },
        {
            execute: () => {
                deps.resetDockLayout();
            },
            id: 'reset-layout',
            keywords: 'layout reset panels dock',
            label: 'Reset Layout',
        },
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
        execute: async () => {
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

