import type { RenderablePaletteAction } from './commandPalettePresentationModel';

import { editorTheme as t } from '../../theme/editorTheme';

export type CommandPaletteActionRowProperties = {
    action: RenderablePaletteAction;
    isActive: boolean;
    onClick: () => void;
    uiScale: number;
};

export function CommandPaletteActionRow({ action, isActive, onClick, uiScale }: CommandPaletteActionRowProperties) {
    return (
        <button
            onClick={onClick}
            style={{
                alignItems: 'center',
                background: isActive ? t.bg.selected : 'transparent',
                border: 'none',
                color: isActive ? t.text.primary : t.text.normal,
                cursor: 'pointer',
                display: 'grid',
                gap: `${10 * uiScale}px`,
                gridTemplateColumns: '1fr auto',
                padding: `${8 * uiScale}px ${12 * uiScale}px`,
                textAlign: 'left',
                width: '100%',
            }}
            type="button"
        >
            <span>{action.label}</span>
            <span style={{ color: t.text.muted, fontSize: `${11 * uiScale}px` }}>{action.hintText}</span>
        </button>
    );
}

