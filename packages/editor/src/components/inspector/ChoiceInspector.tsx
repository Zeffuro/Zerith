import type { ChoiceCommand, ChoiceOption } from 'core';

import { Plus, Trash2 } from 'lucide-react';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { editorTheme as t } from '../../theme/editorTheme';

export function ChoiceInspector({ index, node }: { index?: null | number; node: ChoiceCommand; }) {
    const { applyNodePatch, inputStyle, labelStyle, uiScale } = useInspectorFieldEditor(index);

    const options = Array.isArray(node.options) ? node.options : [];

    const updateOption = (optIndex: number, patch: Partial<ChoiceOption>) => {
        const next = options.map((opt, index_) => (index_ === optIndex ? { ...opt, ...patch } : opt));
        applyNodePatch({ options: next });
    };

    const addOption = () => {
        const next: ChoiceOption[] = [...options, { commands: [], label: `Option ${options.length + 1}` }];
        applyNodePatch({ options: next });
    };

    const removeOption = (optIndex: number) => {
        const next = options.filter((_, index_) => index_ !== optIndex);
        applyNodePatch({ options: next });
    };

    const buttonStyle = {
        alignItems: 'center',
        background: t.bg.panelAlt,
        border: `1px solid ${t.border.button}`,
        borderRadius: t.radius.md,
        color: t.text.normal,
        cursor: 'pointer',
        display: 'inline-flex',
        fontSize: '0.85em',
        gap: '6px',
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
    } as const;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${12 * uiScale}px` }}>
            <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
                <label style={{ ...labelStyle, color: t.syntax.logic, marginBottom: 0 }}>Options</label>
                <button onClick={addOption} style={buttonStyle}>
                    <Plus size={14 * uiScale} /> Add Option
                </button>
            </div>

            {options.length === 0 && (
                <div style={{ color: t.text.muted, fontSize: '0.85em', fontStyle: 'italic' }}>
                    No options yet.
                </div>
            )}

            {options.map((opt, index_) => (
                <div
                    key={index_}
                    style={{
                        background: t.bg.panelAlt,
                        border: `1px solid ${t.border.subtle}`,
                        borderRadius: t.radius.lg,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: `${8 * uiScale}px`,
                        padding: `${10 * uiScale}px`,
                    }}
                >
                    <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: t.text.muted, fontSize: '0.8em', fontWeight: 'bold' }}>
                            OPTION {index_ + 1}
                        </span>
                        <button
                            onClick={() => removeOption(index_)}
                            style={{ ...buttonStyle, background: 'transparent', border: 'none', color: t.accent.red, padding: 0 }}
                            title="Remove option"
                        >
                            <Trash2 size={14 * uiScale} />
                        </button>
                    </div>

                    <div>
                        <label style={labelStyle}>Label</label>
                        <input
                            onChange={(event) => updateOption(index_, { label: event.target.value })}
                            placeholder="Choice text shown to player"
                            style={inputStyle}
                            type="text"
                            value={opt?.label ?? ''}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}