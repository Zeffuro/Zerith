import type { BaseCommand } from 'core';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { useProjectStore } from '../../store/storeBootstrap';
import { FieldError } from './FieldError';

export function CallInspector({ index, node }: { index?: null | number; node: BaseCommand; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle, uiScale } = useInspectorFieldEditor(index);
    const macroName = typeof node.name === 'string' ? node.name : '';
    const macroNames = useProjectStore((state) => state.macroEntries.map((entry) => entry.name));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${12 * uiScale}px` }}>
            <div>
                <label style={labelStyle}>Macro Name</label>
                <input
                    list="call-macro-names"
                    onChange={(event) => handleChange('name', event.target.value)}
                    style={getFieldInputStyle('name')}
                    type="text"
                    value={macroName}
                />
                <FieldError errors={getFieldErrors('name')} />
                <datalist id="call-macro-names">
                    {macroNames.map((name) => <option key={name} value={name} />)}
                </datalist>
                <p style={{ color: '#666', fontSize: '0.8em', fontStyle: 'italic', marginTop: '4px' }}>
                    Available macros are loaded from <b>data/macros.json</b>
                </p>
            </div>
        </div>
    );
}

