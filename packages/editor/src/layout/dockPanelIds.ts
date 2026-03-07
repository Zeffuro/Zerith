export const DOCK_PANELS = {
    toolbar: 'toolbar',
    explorer: 'explorer',
    editor: 'editor',
    preview: 'preview',
    inspector: 'inspector',
    assets: 'assets',
    console: 'console',
} as const;

export type DockPanelId = (typeof DOCK_PANELS)[keyof typeof DOCK_PANELS];