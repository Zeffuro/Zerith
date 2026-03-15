import type { ItemCommand } from 'core';

import { useEffect, useMemo, useState } from 'react';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { useProjectStore } from '../../store/storeBootstrap';
import { editorTheme as t } from '../../theme/editorTheme';
import { FieldError } from './FieldError';

export function ItemInspector({ index, node }: { index?: null | number; node: ItemCommand; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle } = useInspectorFieldEditor(index);
    const itemIds = Object.keys(useProjectStore((state) => state.items));

    const initialJson = useMemo(
        () => JSON.stringify(node.changes ?? {}, undefined, 2),
        [node.changes]
    );

    const [changesJson, setChangesJson] = useState(initialJson);
    const [jsonError, setJsonError] = useState<string | undefined>();

    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            setChangesJson(initialJson);
            setJsonError(undefined);
        });
        return () => cancelAnimationFrame(frame);
    }, [initialJson]);

    const onChangesBlur = () => {
        try {
            const parsed: unknown = changesJson.trim() ? JSON.parse(changesJson) : {};
            if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
                setJsonError('changes must be a JSON object');
                return;
            }
            handleChange('changes', parsed);
            setJsonError(undefined);
        } catch {
            setJsonError('Invalid JSON');
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Action</label>
                <select
                    onChange={(event) => handleChange('action', event.target.value)}
                    style={getFieldInputStyle('action')}
                    value={node.action || 'add'}
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
                    list="item-ids"
                    onChange={(event) => handleChange('id', event.target.value)}
                    placeholder="e.g. attorney_badge"
                    style={getFieldInputStyle('id')}
                    type="text"
                    value={node.id || ''}
                />
                <FieldError errors={getFieldErrors('id')} />
                <datalist id="item-ids">
                    {itemIds.map((itemId) => <option key={itemId} value={itemId} />)}
                </datalist>
            </div>

            {node.action === 'update' && (
                <div>
                    <label style={labelStyle}>Changes (JSON object)</label>
                    <textarea
                        onBlur={onChangesBlur}
                        onChange={(event) => setChangesJson(event.target.value)}
                        rows={8}
                        style={{ ...getFieldInputStyle('changes'), fontFamily: 'monospace' }}
                        value={changesJson}
                    />
                    <FieldError errors={getFieldErrors('changes')} />
                    {jsonError ? (
                        <div style={{ color: t.accent.red, fontSize: '0.8em', marginTop: '4px' }}>{jsonError}</div>
                    ) : (
                        <div style={{ color: t.text.muted, fontSize: '0.8em', marginTop: '4px' }}>
                            Parsed on blur. Example: {"{"}"evidenceLevel":2, "locked":false{"}"}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}