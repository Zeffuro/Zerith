import { editorTheme as t } from './editorTheme';

export const styles = {
    buttonBase: (uiScale: number) => ({
        display: 'flex',
        alignItems: 'center',
        gap: `${6 * uiScale}px`,
        background: 'transparent',
        color: t.text.normal,
        border: `1px solid ${t.border.button}`,
        padding: `${4 * uiScale}px ${12 * uiScale}px`,
        borderRadius: t.radius.md,
        cursor: 'pointer',
        fontSize: 'inherit',
    }),
    iconButton: (uiScale: number) => ({
        background: 'transparent',
        border: 'none',
        color: '#aaa',
        cursor: 'pointer',
        padding: `${4 * uiScale}px`,
    }),
    input: (uiScale: number) => ({
        width: '100%',
        padding: `${8 * uiScale}px`,
        backgroundColor: t.bg.input,
        border: `1px solid ${t.border.input}`,
        color: t.text.primary,
        borderRadius: t.radius.md,
        fontSize: 'inherit',
        outline: 'none',
    }),
    panelHeaderRow: {
        paddingBottom: '8px',
        borderBottom: `1px solid ${t.border.subtle}`,
        display: 'flex',
        justifyContent: 'space-between',
    } as const,
    popup: (uiScale: number) => ({
        background: t.bg.popup,
        border: `1px solid ${t.border.normal}`,
        borderRadius: t.radius.lg,
        boxShadow: t.shadow.popup,
        padding: `${8 * uiScale}px`,
    }),
};