export const editorTheme = {
    accent: {
        blue: 'var(--editor-accent-blue)',
        green: 'var(--editor-accent-green)',
        orange: 'var(--editor-accent-orange)',
        primary: 'var(--editor-accent-primary)',
        purple: 'var(--editor-accent-purple)',
        red: 'var(--editor-accent-red)',
        teal: 'var(--editor-accent-teal)',
        yellow: 'var(--editor-accent-yellow)',
    },
    bg: {
        app: 'var(--editor-bg-app)',
        danger: 'var(--editor-bg-danger)',
        hover: 'var(--editor-bg-hover)',
        input: 'var(--editor-bg-input)',
        panel: 'var(--editor-bg-panel)',
        panelAlt: 'var(--editor-bg-panel-alt)',
        popup: 'var(--editor-bg-popup)',
        preview: 'var(--editor-bg-preview)',
        selected: 'var(--editor-bg-selected)',
    },
    border: {
        accent: 'var(--editor-border-accent)',
        button: 'var(--editor-border-button)',
        focus: 'var(--editor-border-focus)',
        input: 'var(--editor-border-input)',
        normal: 'var(--editor-border-normal)',
        primaryBtn: 'var(--editor-border-primary-btn)',
        subtle: 'var(--editor-border-subtle)',
    },
    icon: {
        audio: 'var(--editor-icon-audio)',
        data: 'var(--editor-icon-data)',
        image: 'var(--editor-icon-image)',
        manifest: 'var(--editor-icon-manifest)',
        script: 'var(--editor-icon-script)',
        text: 'var(--editor-icon-text)',
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