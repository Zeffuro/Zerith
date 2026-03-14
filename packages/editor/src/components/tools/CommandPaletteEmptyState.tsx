import { editorTheme as t } from '../../theme/editorTheme';

type Properties = {
    uiScale: number;
};

export function CommandPaletteEmptyState({ uiScale }: Properties) {
    return (
        <div style={{ color: t.text.faint, fontStyle: 'italic', padding: `${10 * uiScale}px ${12 * uiScale}px` }}>
            No matching commands
        </div>
    );
}

