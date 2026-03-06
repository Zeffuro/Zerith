import type { ThemeFile } from './themeTypes';

export function applyTheme(theme: ThemeFile) {
    const root = document.documentElement;
    Object.entries(theme.vars).forEach(([k, v]) => {
        root.style.setProperty(k, v);
    });
}