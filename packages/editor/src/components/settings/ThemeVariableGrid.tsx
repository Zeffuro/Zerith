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
        <div
            style={{
                display: 'grid',
                gap: `${8 * uiScale}px`,
                gridTemplateColumns: `repeat(auto-fit, minmax(${220 * uiScale}px, 1fr))`,
            }}
        >
            {categoryNames.map((category) => (
                <section
                    key={category}
                    style={{
                        background: t.bg.panelAlt,
                        border: `1px solid ${t.border.subtle}`,
                        borderRadius: t.radius.md,
                        display: 'grid',
                        gap: `${8 * uiScale}px`,
                        padding: `${8 * uiScale}px`,
                    }}
                >
                    <div style={{ color: t.text.normal, fontSize: `${12 * uiScale}px`, fontWeight: 700 }}>{category}</div>
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
                </section>
            ))}
        </div>
    );
}

function fieldLabelStyle(uiScale: number): CSSProperties {
    return {
        alignItems: 'center',
        color: t.text.normal,
        display: 'grid',
        fontSize: `${12 * uiScale}px`,
        gap: `${8 * uiScale}px`,
        gridTemplateColumns: `minmax(${120 * uiScale}px, 1fr) minmax(0, 1fr)`,
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
                <span style={{ color: t.text.normal }}>{variable.label}</span>
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
            <span style={{ color: t.text.normal }}>{variable.label}</span>
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

