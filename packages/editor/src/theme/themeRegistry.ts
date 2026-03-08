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

function normalizeTheme(module_: unknown, _path: string): ThemeFile | undefined {
    const data = (module_ && typeof module_ === 'object' && 'default' in module_)
        ? (module_ as { default: unknown }).default
        : module_;

    if (!data || typeof data !== 'object') return undefined;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = data as Record<string, any>;
    if (!d.key || !d.label || !d.vars) return undefined;

    return {
        key: String(d.key),
        label: String(d.label),
        vars: d.vars,
    };
}