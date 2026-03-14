import type { KeyboardEventHandler } from 'react';

import { editorTheme as t } from '../../theme/editorTheme';

type Properties = {
    onInputChange: (value: string) => void;
    onInputKeyDown: KeyboardEventHandler<HTMLInputElement>;
    query: string;
    uiScale: number;
};

export function CommandPaletteInput({ onInputChange, onInputKeyDown, query, uiScale }: Properties) {
    return (
        <input
            autoFocus
            onChange={(event) => {
                onInputChange(event.target.value);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Type an action (e.g. Save All, Play, Reset Layout)"
            style={{
                background: t.bg.panel,
                border: 'none',
                borderBottom: `1px solid ${t.border.subtle}`,
                color: t.text.normal,
                fontSize: `${13 * uiScale}px`,
                outline: 'none',
                padding: `${10 * uiScale}px ${12 * uiScale}px`,
                width: '100%',
            }}
            value={query}
        />
    );
}

