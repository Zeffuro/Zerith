import { Plus, Trash2 } from 'lucide-react';
import { useInspectorFieldEditor } from './useInspectorFieldEditor';

export function ChoiceInspector({ node, index }: { node: any; index?: number | null }) {
    const { uiScale, labelStyle, inputStyle, applyNodePatch } = useInspectorFieldEditor(index);

    const options = Array.isArray(node.options) ? node.options :[];

    const updateOption = (optIndex: number, patch: Record<string, any>) => {
        const next = options.map((opt: any, i: number) => (i === optIndex ? { ...opt, ...patch } : opt));
        applyNodePatch({ options: next });
    };

    const addOption = () => {
        const next = [...options, { label: `Option ${options.length + 1}`, commands: [] }];
        applyNodePatch({ options: next });
    };

    const removeOption = (optIndex: number) => {
        const next = options.filter((_: any, i: number) => i !== optIndex);
        applyNodePatch({ options: next });
    };

    const btnStyle = {
        background: '#333',
        border: '1px solid #444',
        color: '#ddd',
        borderRadius: '4px',
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '0.85em',
    } as const;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${12 * uiScale}px` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ ...labelStyle, marginBottom: 0, color: '#4ec9b0' }}>Options</label>
                <button onClick={addOption} style={btnStyle}>
                    <Plus size={14 * uiScale} /> Add Option
                </button>
            </div>

            {options.length === 0 && (
                <div style={{ color: '#777', fontStyle: 'italic', fontSize: '0.85em' }}>
                    No options yet.
                </div>
            )}

            {options.map((opt: any, i: number) => (
                <div
                    key={i}
                    style={{
                        border: '1px solid #333',
                        borderRadius: '6px',
                        padding: `${10 * uiScale}px`,
                        background: '#1f1f1f',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: `${8 * uiScale}px`,
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#aaa', fontSize: '0.8em', fontWeight: 'bold' }}>
                            OPTION {i + 1}
                        </span>
                        <button
                            onClick={() => removeOption(i)}
                            style={{ ...btnStyle, border: 'none', background: 'transparent', color: '#f87171', padding: 0 }}
                            title="Remove option"
                        >
                            <Trash2 size={14 * uiScale} />
                        </button>
                    </div>

                    <div>
                        <label style={labelStyle}>Label</label>
                        <input
                            type="text"
                            value={opt?.label ?? ''}
                            onChange={(e) => updateOption(i, { label: e.target.value })}
                            style={inputStyle}
                            placeholder="Choice text shown to player"
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}