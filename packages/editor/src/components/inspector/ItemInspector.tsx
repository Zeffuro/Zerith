import { useMemo, useState, useEffect } from 'react';
import { useInspectorFieldEditor } from './useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function ItemInspector({ node, index }: { node: any; index?: number | null }) {
    const { labelStyle, handleChange, getFieldErrors, getFieldInputStyle } = useInspectorFieldEditor(index);

    const initialJson = useMemo(
        () => JSON.stringify(node.changes ?? {}, null, 2),
        [node.changes]
    );

    const [changesJson, setChangesJson] = useState(initialJson);
    const [jsonError, setJsonError] = useState<string | null>(null);

    useEffect(() => {
        setChangesJson(initialJson);
        setJsonError(null);
    }, [initialJson]);

    const onChangesBlur = () => {
        try {
            const parsed = changesJson.trim() ? JSON.parse(changesJson) : {};
            if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
                setJsonError('changes must be a JSON object');
                return;
            }
            handleChange('changes', parsed);
            setJsonError(null);
        } catch {
            setJsonError('Invalid JSON');
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Action</label>
                <select
                    value={node.action || 'add'}
                    onChange={(e) => handleChange('action', e.target.value)}
                    style={getFieldInputStyle('action')}
                >
                    <option value="add">Add</option>
                    <option value="remove">Remove</option>
                    <option value="update">Update</option>
                </select>
                <FieldError errors={getFieldErrors('action')} />
            </div>

            <div>
                <label style={labelStyle}>Item ID</label>
                <input
                    type="text"
                    value={node.id || ''}
                    onChange={(e) => handleChange('id', e.target.value)}
                    placeholder="e.g. attorney_badge"
                    style={getFieldInputStyle('id')}
                />
                <FieldError errors={getFieldErrors('id')} />
            </div>

            {node.action === 'update' && (
                <div>
                    <label style={labelStyle}>Changes (JSON object)</label>
                    <textarea
                        value={changesJson}
                        onChange={(e) => setChangesJson(e.target.value)}
                        onBlur={onChangesBlur}
                        rows={8}
                        style={{ ...getFieldInputStyle('changes'), fontFamily: 'monospace' }}
                    />
                    <FieldError errors={getFieldErrors('changes')} />
                    {jsonError ? (
                        <div style={{ color: '#f87171', fontSize: '0.8em', marginTop: '4px' }}>{jsonError}</div>
                    ) : (
                        <div style={{ color: '#666', fontSize: '0.8em', marginTop: '4px' }}>
                            Parsed on blur. Example: {"{"}"evidenceLevel":2, "locked":false{"}"}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}