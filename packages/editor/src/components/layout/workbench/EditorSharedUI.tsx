import type { ReactNode } from 'react';

import { editorTheme as t } from '../../../theme/editorTheme';

export function Field({ children, label }: { children: ReactNode; label: string }) {
    return (
        <label style={{ color: t.text.normal, display: 'grid', fontSize: '0.8rem', gap: 6 }}>
            <span>{label}</span>
            {children}
        </label>
    );
}

export const sharedStyles = {
    iconButton: (enabled: boolean, uiScale: number) => ({
        alignItems: 'center',
        background: t.bg.panelAlt,
        border: `1px solid ${t.border.button}`,
        borderRadius: t.radius.sm,
        color: enabled ? t.text.primary : t.text.faint,
        cursor: enabled ? 'pointer' : 'not-allowed',
        display: 'inline-flex',
        fontSize: `${12 * uiScale}px`,
        justifyContent: 'center',
        minWidth: `${30 * uiScale}px`,
        padding: `${4 * uiScale}px`,
    }),
    input: (uiScale: number) => ({
        background: t.bg.input,
        border: `1px solid ${t.border.input}`,
        borderRadius: t.radius.sm,
        color: t.text.primary,
        fontSize: `${12 * uiScale}px`,
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
        width: '100%',
    }),
    panel: (uiScale: number) => ({
        background: t.bg.panel,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.md,
        color: t.text.primary,
        minHeight: 0,
        overflow: 'auto' as const,
        padding: `${10 * uiScale}px`,
    }),
    primaryButton: (uiScale: number) => ({
        background: t.bg.selected,
        border: `1px solid ${t.border.accent}`,
        borderRadius: t.radius.md,
        color: t.text.primary,
        cursor: 'pointer',
        fontSize: `${12 * uiScale}px`,
        fontWeight: 600,
        padding: `${6 * uiScale}px ${10 * uiScale}px`,
    }),
    rowActive: (active: boolean, uiScale: number) => ({
        background: active ? t.bg.selected : t.bg.panelAlt,
        border: `1px solid ${active ? t.border.accent : t.border.button}`,
        borderRadius: t.radius.sm,
        color: active ? t.text.primary : t.text.normal,
        cursor: 'pointer',
        fontSize: `${12 * uiScale}px`,
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
        textAlign: 'left' as const,
    }),
    secondaryButton: (uiScale: number) => ({
        background: t.bg.panelAlt,
        border: `1px solid ${t.border.button}`,
        borderRadius: t.radius.sm,
        color: t.text.primary,
        cursor: 'pointer',
        fontSize: `${12 * uiScale}px`,
        padding: `${4 * uiScale}px ${8 * uiScale}px`,
    }),
    textArea: (uiScale: number) => ({
        background: t.bg.input,
        border: `1px solid ${t.border.input}`,
        borderRadius: t.radius.sm,
        color: t.text.primary,
        fontFamily: 'inherit',
        fontSize: `${12 * uiScale}px`,
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
        resize: 'vertical' as const,
        width: '100%',
    }),
};

export function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}