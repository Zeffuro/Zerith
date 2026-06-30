import { editorTheme as t } from './editorTheme';

export function minimumInteractiveTargetSize(uiScale: number): number {
    return Math.max(28 * uiScale, 24);
}

export const styles = {
    buttonBase: (uiScale: number) => ({
        alignItems: 'center',
        background: 'transparent',
        border: `1px solid ${t.border.button}`,
        borderRadius: t.radius.md,
        color: t.text.normal,
        cursor: 'pointer',
        display: 'flex',
        fontSize: 'inherit',
        gap: `${6 * uiScale}px`,
        minHeight: `${minimumInteractiveTargetSize(uiScale)}px`,
        padding: `${4 * uiScale}px ${12 * uiScale}px`,
    }),
    iconButton: (uiScale: number) => ({
        alignItems: 'center',
        background: 'transparent',
        border: 'none',
        color: '#aaa',
        cursor: 'pointer',
        display: 'inline-flex',
        justifyContent: 'center',
        minHeight: `${minimumInteractiveTargetSize(uiScale)}px`,
        minWidth: `${minimumInteractiveTargetSize(uiScale)}px`,
        padding: `${4 * uiScale}px`,
    }),
    input: (uiScale: number) => ({
        backgroundColor: t.bg.input,
        border: `1px solid ${t.border.input}`,
        borderRadius: t.radius.md,
        color: t.text.primary,
        fontSize: 'inherit',
        outline: 'none',
        padding: `${8 * uiScale}px`,
        width: '100%',
    }),
    panelHeaderRow: {
        borderBottom: `1px solid ${t.border.subtle}`,
        display: 'flex',
        justifyContent: 'space-between',
        paddingBottom: '8px',
    } as const,
    popup: (uiScale: number) => ({
        background: t.bg.popup,
        border: `1px solid ${t.border.normal}`,
        borderRadius: t.radius.lg,
        boxShadow: t.shadow.popup,
        padding: `${8 * uiScale}px`,
    }),
};
