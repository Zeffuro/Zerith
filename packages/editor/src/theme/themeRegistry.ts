import type { ThemeFile } from './themeTypes';

const modules = import.meta.glob('./presets/*.json', { eager: true });

export function getThemeRegistry(): ThemeFile[] {
    const out: ThemeFile[] = [];

    for (const [path, module_] of Object.entries(modules)) {
        const t = normalizeTheme(module_, path);
        if (t) out.push(t);
    }

    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
}

function normalizeTheme(module_: any, _: string): null | ThemeFile {
    const data = module_?.default ?? module_;
    if (!data || typeof data !== 'object') return null;
    if (!data.key || !data.label || !data.vars) return null;

    const variables = data.vars as Record<string, string>;
    return { key: String(data.key), label: String(data.label), vars: variables };
}