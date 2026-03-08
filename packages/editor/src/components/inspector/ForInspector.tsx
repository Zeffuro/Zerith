import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function ForInspector({ node, index }: { node: any; index?: number | null }) {
    const { uiScale, handleChange, labelStyle, getFieldErrors, getFieldInputStyle } = useInspectorFieldEditor(index);

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
        </div>
    );
}