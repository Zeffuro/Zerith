import { useMemo } from 'react';

import type { CustomThemeEntry } from '../../../store/settings/SettingsSchema';

import { editorTheme as t } from '../../../theme/editorTheme';
import { getThemeRegistry } from '../../../theme/themeRegistry';

export function ThemeMenu({
                              customThemes,
                              onSelect,
                              selectedKey,
                              uiScale,
                          }: {
    customThemes: CustomThemeEntry[];
    onSelect: (key: string) => void;
    selectedKey: string;
    uiScale: number;
}) {
    const themes = useMemo(() => getThemeRegistry(customThemes), [customThemes]);

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
            {themes.map((theme) => (
                <option key={theme.key} style={{ background: t.bg.popup, color: t.text.primary }} value={theme.key}>
                    {theme.label}
                </option>
            ))}
        </select>
    );
}
