import type { BaseCommand } from 'core';

import { useMemo } from 'react';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { useProjectStore } from '../../store/storeBootstrap';
import { editorTheme as t } from '../../theme/editorTheme';
import { FieldError } from './FieldError';

export function CallInspector({ index, node }: { index?: null | number; node: BaseCommand; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle, uiScale } = useInspectorFieldEditor(index);
    const macroName = typeof node.name === 'string' ? node.name : '';
    const macroEntries = useProjectStore((state) => state.macroEntries);
    const macroNames = useMemo(() => macroEntries.map((entry) => entry.name), [macroEntries]);

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
                <p style={{ color: t.text.muted, fontSize: '0.8em', fontStyle: 'italic', marginTop: '4px' }}>
                    Available macros are loaded from <b>data/macros.json</b>
                </p>
            </div>
        </div>
    );
}

