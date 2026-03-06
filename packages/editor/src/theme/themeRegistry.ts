import type { ThemeFile } from './themeTypes';

const modules = import.meta.glob('../themes/*.json', { eager: true }) as Record<string, any>;

function normalizeTheme(mod: any, _: string): ThemeFile | null {
    const data = mod?.default ?? mod;
    if (!data || typeof data !== 'object') return null;
    if (!data.key || !data.label || !data.vars) return null;

    const vars = data.vars as Record<string, string>;
    return { key: String(data.key), label: String(data.label), vars };
}

export function getThemeRegistry(): ThemeFile[] {
    const out: ThemeFile[] = [];

    for (const [path, mod] of Object.entries(modules)) {
        const t = normalizeTheme(mod, path);
        if (t) out.push(t);
    }

    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
}