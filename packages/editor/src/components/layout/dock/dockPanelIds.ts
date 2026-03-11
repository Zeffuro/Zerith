export const DOCK_PANELS = {
    assets: 'assets',
    console: 'console',
    editor: 'editor',
    explorer: 'explorer',
    inspector: 'inspector',
    preview: 'preview',
    runtimeMonitor: 'runtime_monitor',
    stateObserver: 'state_observer',
    toolbar: 'toolbar',
} as const;

export type DockPanelId = (typeof DOCK_PANELS)[keyof typeof DOCK_PANELS];
