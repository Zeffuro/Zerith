import { useMemo } from 'react';
import { getThemeRegistry } from '../../theme/themeRegistry';

export function ThemeMenu({
                              uiScale,
                              selectedKey,
                              onSelect,
                          }: {
    uiScale: number;
    selectedKey: string;
    onSelect: (key: string) => void;
}) {
    const themes = useMemo(() => getThemeRegistry(), []);

    return (
        <select
            value={selectedKey}
            onChange={(e) => onSelect(e.target.value)}
            style={{
                background: 'transparent',
                color: 'var(--editor-text-normal)',
                border: '1px solid var(--editor-border-button)',
                borderRadius: 'var(--editor-radius-md)',
                padding: `${4 * uiScale}px ${8 * uiScale}px`,
                fontSize: 'inherit',
                cursor: 'pointer',
            }}
            title="Editor Theme"
        >
            {themes.map((t) => (
                <option key={t.key} value={t.key} style={{ background: '#1f1f1f', color: '#fff' }}>
                    {t.label}
                </option>
            ))}
        </select>
    );
}