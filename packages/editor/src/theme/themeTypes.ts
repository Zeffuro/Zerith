export interface ThemeFile {
    key: string;
    label: string;
    vars: ThemeVars;
}

export type ThemeVars = Record<string, string>;