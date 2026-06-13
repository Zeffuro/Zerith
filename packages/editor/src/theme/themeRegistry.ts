import type { CustomThemeEntry } from '../store/settings/SettingsSchema';
import type { ThemeFile } from './themeTypes';

type ThemeModule = { default: unknown };

const modules = import.meta.glob<ThemeModule>('./presets/*.json', { eager: true });

export function getFullThemeRegistry(customThemes: CustomThemeEntry[] = []): ThemeFile[] {
    const builtInThemes = getBuiltInThemeRegistry();
    const sortedCustomThemes = customThemes
        .map((theme) => ({
            key: theme.key,
            label: theme.label,
            vars: theme.vars,
        }))
        .toSorted((a, b) => a.label.localeCompare(b.label));

    return [...builtInThemes, ...sortedCustomThemes];
}

export function getThemeRegistry(customThemes: CustomThemeEntry[] = []): ThemeFile[] {
    return getFullThemeRegistry(customThemes);
}

export function isCustomTheme(key: string, customThemes: CustomThemeEntry[]): boolean {
    return customThemes.some((theme) => theme.key === key);
}

export function normalizeTheme(module_: unknown): ThemeFile | undefined {
    const data = (module_ && typeof module_ === 'object' && 'default' in module_)
        ? (module_).default
        : module_;

    if (!data || typeof data !== 'object') return undefined;
    
    const d = data as Record<string, unknown>;
    if (typeof d.key !== 'string' || typeof d.label !== 'string') return undefined;
    if (!d.vars || typeof d.vars !== 'object' || Array.isArray(d.vars)) return undefined;

    return {
        key: d.key,
        label: d.label,
        vars: d.vars as Record<string, string>,
    };
}

function getBuiltInThemeRegistry(): ThemeFile[] {
    const out: ThemeFile[] = [];

    for (const module_ of Object.values(modules)) {
        const t = normalizeTheme(module_);
        if (t) out.push(t);
    }

    return out.toSorted((a, b) => a.label.localeCompare(b.label));
}
