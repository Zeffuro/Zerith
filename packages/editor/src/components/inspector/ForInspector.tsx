import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function ForInspector({ index, node }: { index?: null | number; node: any; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle, uiScale } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${12 * uiScale}px` }}>
            <div>
                <label style={labelStyle}>Iterator Variable</label>
                <input
                    onChange={(e) => handleChange('iterator', e.target.value)}
                    placeholder="i"
                    style={getFieldInputStyle('iterator')}
                    type="text"
                    value={node.iterator ?? 'i'}
                />
                <FieldError errors={getFieldErrors('iterator')} />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>From</label>
                    <input
                        onChange={(e) => handleChange('from', Number(e.target.value))}
                        style={getFieldInputStyle('from')}
                        type="number"
                        value={node.from ?? 0}
                    />
                    <FieldError errors={getFieldErrors('from')} />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>To</label>
                    <input
                        onChange={(e) => handleChange('to', Number(e.target.value))}
                        style={getFieldInputStyle('to')}
                        type="number"
                        value={node.to ?? 0}
                    />
                    <FieldError errors={getFieldErrors('to')} />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Step</label>
                    <input
                        onChange={(e) => handleChange('step', Number(e.target.value))}
                        style={getFieldInputStyle('step')}
                        type="number"
                        value={node.step ?? 1}
                    />
                    <FieldError errors={getFieldErrors('step')} />
                </div>
            </div>
        </div>
    );
}