export const editorTheme = {
    accent: {
        green: 'var(--editor-accent-green)',
        primary: 'var(--editor-accent-primary)',
        red: 'var(--editor-accent-red)',
    },
    bg: {
        app: 'var(--editor-bg-app)',
        danger: 'var(--editor-bg-danger)',
        hover: 'var(--editor-bg-hover)',
        input: 'var(--editor-bg-input)',
        panel: 'var(--editor-bg-panel)',
        panelAlt: 'var(--editor-bg-panel-alt)',
        popup: 'var(--editor-bg-popup)',
        selected: 'var(--editor-bg-selected)',
    },
    border: {
        accent: 'var(--editor-border-accent)',
        button: 'var(--editor-border-button)',
        input: 'var(--editor-border-input)',
        normal: 'var(--editor-border-normal)',
        primaryBtn: 'var(--editor-border-primary-btn)',
        subtle: 'var(--editor-border-subtle)',
    },
    radius: {
        lg: 'var(--editor-radius-lg)',
        md: 'var(--editor-radius-md)',
        sm: 'var(--editor-radius-sm)',
    },
    shadow: {
        popup: 'var(--editor-shadow-popup)',
        popupStrong: 'var(--editor-shadow-popup-strong)',
    },
    syntax: {
        flow: 'var(--editor-syntax-flow)',
        highlightBg: 'var(--editor-syntax-highlight-bg)',
        highlightText: 'var(--editor-syntax-highlight-text)',
        logic: 'var(--editor-syntax-logic)',
        media: 'var(--editor-syntax-media)',
    },
    text: {
        faint: 'var(--editor-text-faint)',
        muted: 'var(--editor-text-muted)',
        normal: 'var(--editor-text-normal)',
        primary: 'var(--editor-text-primary)',
    },
} as const;

export type EditorTheme = typeof editorTheme;