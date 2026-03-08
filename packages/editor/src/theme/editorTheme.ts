export const editorTheme = {
    bg: {
        app: 'var(--editor-bg-app)',
        panel: 'var(--editor-bg-panel)',
        panelAlt: 'var(--editor-bg-panel-alt)',
        input: 'var(--editor-bg-input)',
        popup: 'var(--editor-bg-popup)',
        hover: 'var(--editor-bg-hover)',
        selected: 'var(--editor-bg-selected)',
        danger: 'var(--editor-bg-danger)',
    },
    border: {
        subtle: 'var(--editor-border-subtle)',
        normal: 'var(--editor-border-normal)',
        input: 'var(--editor-border-input)',
        button: 'var(--editor-border-button)',
        accent: 'var(--editor-border-accent)',
        primaryBtn: 'var(--editor-border-primary-btn)',
    },
    text: {
        primary: 'var(--editor-text-primary)',
        normal: 'var(--editor-text-normal)',
        muted: 'var(--editor-text-muted)',
        faint: 'var(--editor-text-faint)',
    },
    accent: {
        primary: 'var(--editor-accent-primary)',
        red: 'var(--editor-accent-red)',
        green: 'var(--editor-accent-green)',
    },
    syntax: {
        logic: 'var(--editor-syntax-logic)',
        flow: 'var(--editor-syntax-flow)',
        media: 'var(--editor-syntax-media)',
        highlightBg: 'var(--editor-syntax-highlight-bg)',
        highlightText: 'var(--editor-syntax-highlight-text)',
    },
    shadow: {
        popup: 'var(--editor-shadow-popup)',
        popupStrong: 'var(--editor-shadow-popup-strong)',
    },
    radius: {
        sm: 'var(--editor-radius-sm)',
        md: 'var(--editor-radius-md)',
        lg: 'var(--editor-radius-lg)',
    },
} as const;

export type EditorTheme = typeof editorTheme;