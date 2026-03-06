export type ThemeVars = Record<string, string>;

export interface ThemeFile {
    key: string;
    label: string;
    vars: ThemeVars;
}