export interface ThemeVariableEntry {
    category: string;
    cssVar: string;
    defaultValue?: string;
    label: string;
    type: 'color' | 'shadow' | 'size';
}

const variableCategoryPrefixes = [
    { category: 'Background', cssPrefix: '--editor-bg-' },
    { category: 'Text', cssPrefix: '--editor-text-' },
    { category: 'Border', cssPrefix: '--editor-border-' },
    { category: 'Accent', cssPrefix: '--editor-accent-' },
    { category: 'Radius', cssPrefix: '--editor-radius-' },
    { category: 'Shadow', cssPrefix: '--editor-shadow-' },
    { category: 'Syntax', cssPrefix: '--editor-syntax-' },
] as const;

export const themeVariableCatalog: ThemeVariableEntry[] = [
    // Background
    { category: 'Background', cssVar: '--editor-bg-app', defaultValue: '#1e1e1e', label: 'App Background', type: 'color' },
    { category: 'Background', cssVar: '--editor-bg-panel', defaultValue: '#252526', label: 'Panel Background', type: 'color' },
    { category: 'Background', cssVar: '--editor-bg-panel-alt', defaultValue: '#2d2d2d', label: 'Panel Alt Background', type: 'color' },
    { category: 'Background', cssVar: '--editor-bg-input', defaultValue: '#1e1e1e', label: 'Input Background', type: 'color' },
    { category: 'Background', cssVar: '--editor-bg-popup', defaultValue: '#1f1f1f', label: 'Popup Background', type: 'color' },
    { category: 'Background', cssVar: '--editor-bg-hover', defaultValue: '#2a2a2a', label: 'Hover Background', type: 'color' },
    { category: 'Background', cssVar: '--editor-bg-selected', defaultValue: '#04395e', label: 'Selected Background', type: 'color' },
    { category: 'Background', cssVar: '--editor-bg-danger', defaultValue: '#882222', label: 'Danger Background', type: 'color' },
    { category: 'Background', cssVar: '--editor-bg-preview', defaultValue: '#000', label: 'Preview Background', type: 'color' },

    // Text
    { category: 'Text', cssVar: '--editor-text-primary', defaultValue: '#fff', label: 'Primary Text', type: 'color' },
    { category: 'Text', cssVar: '--editor-text-normal', defaultValue: '#ccc', label: 'Normal Text', type: 'color' },
    { category: 'Text', cssVar: '--editor-text-muted', defaultValue: '#888', label: 'Muted Text', type: 'color' },
    { category: 'Text', cssVar: '--editor-text-faint', defaultValue: '#666', label: 'Faint Text', type: 'color' },

    // Accent
    { category: 'Accent', cssVar: '--editor-accent-primary', defaultValue: '#0e639c', label: 'Primary Accent', type: 'color' },
    { category: 'Accent', cssVar: '--editor-accent-red', defaultValue: '#f87171', label: 'Red Accent', type: 'color' },
    { category: 'Accent', cssVar: '--editor-accent-green', defaultValue: '#22c55e', label: 'Green Accent', type: 'color' },
    { category: 'Accent', cssVar: '--editor-accent-yellow', defaultValue: '#fbbf24', label: 'Yellow Accent', type: 'color' },
    { category: 'Accent', cssVar: '--editor-accent-blue', defaultValue: '#60a5fa', label: 'Blue Accent', type: 'color' },
    { category: 'Accent', cssVar: '--editor-accent-purple', defaultValue: '#a78bfa', label: 'Purple Accent', type: 'color' },
    { category: 'Accent', cssVar: '--editor-accent-teal', defaultValue: '#34d399', label: 'Teal Accent', type: 'color' },
    { category: 'Accent', cssVar: '--editor-accent-orange', defaultValue: '#f59e0b', label: 'Orange Accent', type: 'color' },

    // Border
    { category: 'Border', cssVar: '--editor-border-subtle', defaultValue: '#333', label: 'Subtle Border', type: 'color' },
    { category: 'Border', cssVar: '--editor-border-normal', defaultValue: '#3a3a3a', label: 'Normal Border', type: 'color' },
    { category: 'Border', cssVar: '--editor-border-input', defaultValue: '#3c3c3c', label: 'Input Border', type: 'color' },
    { category: 'Border', cssVar: '--editor-border-button', defaultValue: '#555', label: 'Button Border', type: 'color' },
    { category: 'Border', cssVar: '--editor-border-accent', defaultValue: '#007fd4', label: 'Accent Border', type: 'color' },
    { category: 'Border', cssVar: '--editor-border-focus', defaultValue: '#007fd4', label: 'Focus Border', type: 'color' },
    { category: 'Border', cssVar: '--editor-border-primary-btn', defaultValue: '#1f7ab7', label: 'Primary Button Border', type: 'color' },

    // Icon
    { category: 'Icon', cssVar: '--editor-icon-manifest', defaultValue: '#fbbf24', label: 'Manifest Icon', type: 'color' },
    { category: 'Icon', cssVar: '--editor-icon-image', defaultValue: '#4ec9b0', label: 'Image Icon', type: 'color' },
    { category: 'Icon', cssVar: '--editor-icon-audio', defaultValue: '#d8b4fe', label: 'Audio Icon', type: 'color' },
    { category: 'Icon', cssVar: '--editor-icon-script', defaultValue: '#4ade80', label: 'Script Icon', type: 'color' },
    { category: 'Icon', cssVar: '--editor-icon-text', defaultValue: '#9ca3af', label: 'Text Icon', type: 'color' },
    { category: 'Icon', cssVar: '--editor-icon-data', defaultValue: '#ce9178', label: 'Data Icon', type: 'color' },

    // Syntax
    { category: 'Syntax', cssVar: '--editor-syntax-logic', defaultValue: '#4ec9b0', label: 'Logic Syntax', type: 'color' },
    { category: 'Syntax', cssVar: '--editor-syntax-flow', defaultValue: '#f59e0b', label: 'Flow Syntax', type: 'color' },
    { category: 'Syntax', cssVar: '--editor-syntax-media', defaultValue: '#f472b6', label: 'Media Syntax', type: 'color' },
    { category: 'Syntax', cssVar: '--editor-syntax-highlight-bg', defaultValue: 'rgba(250, 204, 21, 0.25)', label: 'Highlight Background', type: 'color' },
    { category: 'Syntax', cssVar: '--editor-syntax-highlight-text', defaultValue: '#fde68a', label: 'Highlight Text', type: 'color' },

    // Radius
    { category: 'Radius', cssVar: '--editor-radius-sm', defaultValue: '3px', label: 'Small Radius', type: 'size' },
    { category: 'Radius', cssVar: '--editor-radius-md', defaultValue: '4px', label: 'Medium Radius', type: 'size' },
    { category: 'Radius', cssVar: '--editor-radius-lg', defaultValue: '6px', label: 'Large Radius', type: 'size' },

    // Shadow
    { category: 'Shadow', cssVar: '--editor-shadow-popup', defaultValue: '0 8px 20px rgba(0,0,0,0.35)', label: 'Popup Shadow', type: 'shadow' },
    { category: 'Shadow', cssVar: '--editor-shadow-popup-strong', defaultValue: '0 10px 24px rgba(0,0,0,0.4)', label: 'Strong Popup Shadow', type: 'shadow' },
];

export function getVariableCategories(): string[] {
    return variableCategoryPrefixes
        .filter(({ cssPrefix }) => themeVariableCatalog.some((variable) => variable.cssVar.startsWith(cssPrefix)))
        .map(({ category }) => category);
}

export function getVariablesByCategory(category: string): ThemeVariableEntry[] {
    const categoryPrefix = variableCategoryPrefixes.find((entry) => entry.category === category)?.cssPrefix;
    if (!categoryPrefix) return [];

    return themeVariableCatalog.filter((variable) => variable.cssVar.startsWith(categoryPrefix));
}

