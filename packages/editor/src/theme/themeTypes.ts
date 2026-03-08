export interface ThemeFile {
    key: string;
    label: string;
    vars: ThemeVariables;
}

export type ThemeVariables = Record<string, string>;
