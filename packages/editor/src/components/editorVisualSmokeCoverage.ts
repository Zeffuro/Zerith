export type EditorVisualSmokeScenario = {
    assertions: string[];
    id: string;
    surface: EditorVisualSmokeSurface;
    viewports: EditorVisualSmokeViewportId[];
};

export type EditorVisualSmokeSurface =
    | 'asset-metadata-dialog'
    | 'command-palette'
    | 'dialogue-inspector'
    | 'export-modal'
    | 'git-panel'
    | 'global-live-status'
    | 'new-project-modal'
    | 'project-validation-panel'
    | 'settings-modal';

export type EditorVisualSmokeViewport = {
    height: number;
    id: EditorVisualSmokeViewportId;
    width: number;
};

export type EditorVisualSmokeViewportId = 'compact' | 'desktop';

export const EDITOR_VISUAL_SMOKE_VIEWPORTS: EditorVisualSmokeViewport[] = [
    { height: 844, id: 'compact', width: 390 },
    { height: 900, id: 'desktop', width: 1440 },
];

export const EDITOR_VISUAL_SMOKE_SCENARIOS: EditorVisualSmokeScenario[] = [
    {
        assertions: [
            'dialog has aria-modal and visible focus stays inside the modal',
            'keyboard focus returns to the opener after closing',
            'empty results status remains visible and announced',
        ],
        id: 'command-palette-empty-search',
        surface: 'command-palette',
        viewports: ['desktop', 'compact'],
    },
    {
        assertions: [
            'settings dialog traps focus while open',
            'editor accessibility controls are visible without horizontal overflow',
            'reset and close controls preserve 24px minimum targets',
        ],
        id: 'settings-editor-accessibility-profile',
        surface: 'settings-modal',
        viewports: ['desktop', 'compact'],
    },
    {
        assertions: [
            'export dialog status region announces idle, running, and finished states',
            'profile and path fields remain readable at compact width',
            'footer actions preserve visible focus and target size',
        ],
        id: 'export-modal-status',
        surface: 'export-modal',
        viewports: ['desktop', 'compact'],
    },
    {
        assertions: [
            'template cards remain navigable as radio buttons',
            'creation status uses a live region',
            'browse and create actions preserve visible focus and target size',
        ],
        id: 'new-project-template-selection',
        surface: 'new-project-modal',
        viewports: ['desktop', 'compact'],
    },
    {
        assertions: [
            'run status updates without layout shift',
            'issue jump buttons expose visible focus',
            'empty state is announced as status',
        ],
        id: 'project-validation-results',
        surface: 'project-validation-panel',
        viewports: ['desktop', 'compact'],
    },
    {
        assertions: [
            'busy state is exposed while Git operations run',
            'last operation message is announced as status',
            'dense action rows preserve target size',
        ],
        id: 'git-panel-operation-status',
        surface: 'git-panel',
        viewports: ['desktop', 'compact'],
    },
    {
        assertions: [
            'metadata editor traps focus and restores it after close',
            'chip previews remain readable',
            'save and close controls preserve target size',
        ],
        id: 'asset-metadata-editor-dialog',
        surface: 'asset-metadata-dialog',
        viewports: ['desktop', 'compact'],
    },
    {
        assertions: [
            'line ID badge and voice chips remain readable',
            'inline formatting buttons preserve target size',
            'asset open action is focus-visible and not clipped',
        ],
        id: 'dialogue-inspector-dense-controls',
        surface: 'dialogue-inspector',
        viewports: ['desktop', 'compact'],
    },
    {
        assertions: [
            'operation toast is announced by a polite live region',
            'toast does not block pointer input behind it',
            'long status text wraps inside viewport bounds',
        ],
        id: 'global-live-operation-status',
        surface: 'global-live-status',
        viewports: ['desktop', 'compact'],
    },
];

export function getEditorVisualSmokeScenarioIdsForSurface(
    surface: EditorVisualSmokeSurface,
): string[] {
    return EDITOR_VISUAL_SMOKE_SCENARIOS
        .filter((scenario) => scenario.surface === surface)
        .map((scenario) => scenario.id);
}
