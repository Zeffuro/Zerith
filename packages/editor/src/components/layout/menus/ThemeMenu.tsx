import { useMemo } from 'react';

import { getThemeRegistry } from '../../../theme/themeRegistry';

export function ThemeMenu({
                              onSelect,
                              selectedKey,
                              uiScale,
                          }: {
    onSelect: (key: string) => void;
    selectedKey: string;
    uiScale: number;
}) {
    const themes = useMemo(() => getThemeRegistry(), []);

    return (
        <select
            onChange={(event) => onSelect(event.target.value)}
            style={{
                background: 'transparent',
                border: '1px solid var(--editor-border-button)',
                borderRadius: 'var(--editor-radius-md)',
                color: 'var(--editor-text-normal)',
                cursor: 'pointer',
                fontSize: 'inherit',
                padding: `${4 * uiScale}px ${8 * uiScale}px`,
            }}
            title="Editor Theme"
            value={selectedKey}
        >
            {themes.map((t) => (
                <option key={t.key} style={{ background: '#1f1f1f', color: '#fff' }} value={t.key}>
                    {t.label}
                </option>
            ))}
        </select>
    );
}
