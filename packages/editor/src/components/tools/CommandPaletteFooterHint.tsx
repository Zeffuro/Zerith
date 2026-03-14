import { editorTheme as t } from '../../theme/editorTheme';

type Properties = {
    uiScale: number;
};

export function CommandPaletteFooterHint({ uiScale }: Properties) {
    return (
        <div style={{ borderTop: `1px solid ${t.border.subtle}`, color: t.text.muted, fontSize: `${11 * uiScale}px`, padding: `${8 * uiScale}px ${12 * uiScale}px` }}>
            Enter to run - Esc to close - Up/Down to navigate
        </div>
    );
}

