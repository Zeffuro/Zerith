import { ArrowRight } from 'lucide-react';
import { useScriptStore } from '../../store/useScriptStore';
import { useInspectorFieldEditor } from './useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function ForInspector({ node, index }: { node: any; index?: number | null }) {
    const { pushScope } = useScriptStore();
    const { uiScale, handleChange, labelStyle, getFieldErrors, getFieldInputStyle } = useInspectorFieldEditor(index);

    const btnStyle = {
        width: '100%',
        padding: `${8 * uiScale}px`,
        backgroundColor: '#333',
        border: 'none',
        color: '#fff',
        borderRadius: '4px',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '8px',
    } as const;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${12 * uiScale}px` }}>
            <div>
                <label style={labelStyle}>Iterator Variable</label>
                <input
                    type="text"
                    value={node.iterator ?? 'i'}
                    onChange={(e) => handleChange('iterator', e.target.value)}
                    placeholder="i"
                    style={getFieldInputStyle('iterator')}
                />
                <FieldError errors={getFieldErrors('iterator')} />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>From</label>
                    <input
                        type="number"
                        value={node.from ?? 0}
                        onChange={(e) => handleChange('from', Number(e.target.value))}
                        style={getFieldInputStyle('from')}
                    />
                    <FieldError errors={getFieldErrors('from')} />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>To</label>
                    <input
                        type="number"
                        value={node.to ?? 0}
                        onChange={(e) => handleChange('to', Number(e.target.value))}
                        style={getFieldInputStyle('to')}
                    />
                    <FieldError errors={getFieldErrors('to')} />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Step</label>
                    <input
                        type="number"
                        value={node.step ?? 1}
                        onChange={(e) => handleChange('step', Number(e.target.value))}
                        style={getFieldInputStyle('step')}
                    />
                    <FieldError errors={getFieldErrors('step')} />
                </div>
            </div>

            <div style={{ borderTop: '1px solid #333', paddingTop: '12px' }}>
                <label style={{ ...labelStyle, color: '#4ec9b0' }}>Branch</label>
                <button
                    onClick={() => index !== null && index !== undefined && pushScope(index, 'body')}
                    style={btnStyle}
                >
                    <span>Edit "BODY" Block ({node.body?.length || 0} cmds)</span>
                    <ArrowRight size={14 * uiScale} />
                </button>
            </div>
        </div>
    );
}