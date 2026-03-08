import type { ThemeFile } from './themeTypes';

export function applyTheme(theme: ThemeFile) {
    const root = document.documentElement;
    for (const [k, v] of Object.entries(theme.vars)) {
        root.style.setProperty(k, v);
    }
}