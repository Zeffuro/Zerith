import { type CSSProperties } from 'react';

import type { ThemeVariables } from '../../theme/themeTypes';

import { editorTheme as t } from '../../theme/editorTheme';
import { getVariablesByCategory, type ThemeVariableEntry } from '../../theme/themeVariableCatalog';

type ThemeVariableGridProperties = {
    categoryNames: string[];
    onChange: (cssVariable: string, value: string) => void;
    uiScale: number;
    vars: ThemeVariables;
};

export function ThemeVariableGrid({ categoryNames, onChange, uiScale, vars }: ThemeVariableGridProperties) {
    return (
        <>
            {categoryNames.map((category) => (
                <div key={category} style={{ display: 'grid', gap: `${6 * uiScale}px` }}>
                    <div style={{ color: t.text.normal, fontSize: `${12 * uiScale}px`, fontWeight: 600 }}>{category}</div>
                    <div style={{ display: 'grid', gap: `${6 * uiScale}px` }}>
                        {getVariablesByCategory(category).map((variable) => (
                            <ThemeVariableEditorField
                                key={variable.cssVar}
                                onChange={onChange}
                                uiScale={uiScale}
                                value={vars[variable.cssVar] ?? variable.defaultValue ?? ''}
                                variable={variable}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </>
    );
}

function fieldLabelStyle(uiScale: number): CSSProperties {
    return {
        color: t.text.normal,
        display: 'grid',
        fontSize: `${12 * uiScale}px`,
        gap: `${4 * uiScale}px`,
    };
}

function inputStyle(uiScale: number): CSSProperties {
    return {
        background: t.bg.input,
        border: `1px solid ${t.border.normal}`,
        borderRadius: t.radius.md,
        color: t.text.primary,
        fontSize: `${12 * uiScale}px`,
        minWidth: 0,
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
    };
}

function normalizeHexColor(value: string): string | undefined {
    const trimmed = value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;

    if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
        const expanded = Array.from(trimmed.slice(1), (digit) => `${digit}${digit}`).join('');
        return `#${expanded}`;
    }

    return;
}

function ThemeVariableEditorField({
    onChange,
    uiScale,
    value,
    variable,
}: {
    onChange: (cssVariable: string, value: string) => void;
    uiScale: number;
    value: string;
    variable: ThemeVariableEntry;
}) {
    if (variable.type === 'color') {
        const colorValue = normalizeHexColor(value) ?? '#000000';

        return (
            <label style={fieldLabelStyle(uiScale)}>
                {variable.label}
                <div style={{ display: 'grid', gap: `${6 * uiScale}px`, gridTemplateColumns: `${36 * uiScale}px 1fr` }}>
                    <input
                        onChange={(event) => onChange(variable.cssVar, event.currentTarget.value)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                        type="color"
                        value={colorValue}
                    />
                    <input onChange={(event) => onChange(variable.cssVar, event.currentTarget.value)} style={inputStyle(uiScale)} type="text" value={value} />
                </div>
            </label>
        );
    }

    return (
        <label style={fieldLabelStyle(uiScale)}>
            {variable.label}
            <input
                onChange={(event) => onChange(variable.cssVar, event.currentTarget.value)}
                placeholder={variable.type === 'size' ? 'e.g. 4px or 0.4rem' : undefined}
                style={inputStyle(uiScale)}
                type="text"
                value={value}
            />
        </label>
    );
}

