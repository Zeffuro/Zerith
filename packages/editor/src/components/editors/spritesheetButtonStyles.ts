import { type CSSProperties, type MouseEvent } from 'react';

import { editorTheme as t } from '../../theme/editorTheme';

export type SpritesheetButtonStyleOptions = {
    active?: boolean;
    disabled?: boolean;
};

export function applySpritesheetButtonHover(event: MouseEvent<HTMLButtonElement>, disabled: boolean, active: boolean) {
    if (disabled || active) return;
    event.currentTarget.style.background = t.bg.hover;
}

export function applySpritesheetButtonPressed(event: MouseEvent<HTMLButtonElement>, disabled: boolean, active: boolean) {
    if (disabled || active) return;
    event.currentTarget.style.background = t.bg.selected;
}

export function resetSpritesheetButtonBackground(event: MouseEvent<HTMLButtonElement>, disabled: boolean, active: boolean) {
    if (disabled || active) {
        event.currentTarget.style.background = active ? t.bg.selected : t.bg.panel;
        return;
    }
    event.currentTarget.style.background = t.bg.panel;
}

export function spritesheetButtonStyle(options: SpritesheetButtonStyleOptions = {}): CSSProperties {
    const { active = false, disabled = false } = options;
    return {
        alignItems: 'center',
        background: active ? t.bg.selected : t.bg.panel,
        border: `1px solid ${active ? t.accent.primary : t.border.button}`,
        borderRadius: t.radius.sm,
        color: t.text.normal,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        gap: 6,
        justifyContent: 'center',
        opacity: disabled ? 0.6 : 1,
        padding: '4px 10px',
    };
}

