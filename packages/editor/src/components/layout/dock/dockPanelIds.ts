export const DOCK_PANELS = {
    assetDependencies: 'asset_dependencies',
    console: 'console',
    editor: 'editor',
    explorer: 'explorer',
    globalSearch: 'global_search',
    inspector: 'inspector',
    localization: 'localization',
    preview: 'preview',
    projectValidation: 'project_validation',
    referenceTracker: 'reference_tracker',
    runtimeMonitor: 'runtime_monitor',
    stateObserver: 'state_observer',
    toolbar: 'toolbar',
} as const;

export type DockPanelId = (typeof DOCK_PANELS)[keyof typeof DOCK_PANELS];
