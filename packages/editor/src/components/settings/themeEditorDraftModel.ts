import type { ThemeFile, ThemeVariables } from '../../theme/themeTypes';

import { themeVariableCatalog } from '../../theme/themeVariableCatalog';

export function buildPreviewTheme(
    baseThemeKey: string | undefined,
    draftVariables: ThemeVariables,
    themes: ThemeFile[],
    key: string | undefined,
    label: string,
): ThemeFile {
    const fallbackTheme = themes.find((theme) => theme.key === 'classic') ?? themes[0];
    const baseTheme = themes.find((theme) => theme.key === baseThemeKey) ?? fallbackTheme;
    const baseVariables = baseTheme ? cloneThemeVariables(baseTheme) : {};

    return {
        key: key ?? 'preview',
        label: label.trim() || 'Preview',
        vars: {
            ...baseVariables,
            ...draftVariables,
        },
    };
}

export function buildUniqueThemeKey(label: string, existingKeys: string[]): string {
    const slug = label
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, '-')
        .replaceAll(/^-+|-+$/g, '') || 'theme';

    const baseKey = `custom-${slug}`;
    const existing = new Set(existingKeys);

    if (!existing.has(baseKey)) return baseKey;

    let index = 2;
    while (existing.has(`${baseKey}-${index}`)) {
        index += 1;
    }

    return `${baseKey}-${index}`;
}

export function cloneThemeVariables(theme: ThemeFile): ThemeVariables {
    const variables = { ...theme.vars };

    for (const variable of themeVariableCatalog) {
        if (variables[variable.cssVar]) continue;
        if (!variable.defaultValue) continue;
        variables[variable.cssVar] = variable.defaultValue;
    }

    return variables;
}

