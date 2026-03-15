import type { CSSProperties, Dispatch, ReactElement, SetStateAction } from 'react';

import { Plus, Trash2, Zap } from 'lucide-react';

import { editorTheme as t } from '../../theme/editorTheme';
import {
    defaultValueForKind,
    detectDraftValueKind,
    type DraftValueKind,
    safeStringValue,
    type StateDraftRow,
} from './stateObserverModel';

type StateObserverVariablesProperties = {
    onApplyStateRow: (rowId: string) => void;
    onDirty: () => void;
    onGenerateRowId: () => string;
    setHasDraftChanges: Dispatch<SetStateAction<boolean>>;
    setStateDraftRows: Dispatch<SetStateAction<StateDraftRow[]>>;
    stateDraftRows: StateDraftRow[];
    uiScale: number;
};

export function StateObserverVariables({
    onApplyStateRow,
    onDirty,
    onGenerateRowId,
    setHasDraftChanges,
    setStateDraftRows,
    stateDraftRows,
    uiScale,
}: StateObserverVariablesProperties) {
    const markDirty = () => {
        setHasDraftChanges(true);
        onDirty();
    };

    const addStateRow = () => {
        setStateDraftRows((rows) => [...rows, { id: onGenerateRowId(), key: '', valueText: 'null' }]);
        markDirty();
    };

    return (
        <section style={sectionStyle(uiScale)}>
            <div style={{ alignItems: 'center', display: 'flex', marginBottom: `${6 * uiScale}px` }}>
                <strong>State Variables</strong>
                <button className="toolbar-btn" onClick={addStateRow} style={{ marginLeft: 'auto', padding: `${2 * uiScale}px ${6 * uiScale}px` }}>
                    <Plus size={12 * uiScale} /> Add
                </button>
            </div>

            {stateDraftRows.length === 0 && <div style={{ color: t.text.faint, fontStyle: 'italic' }}>No state keys.</div>}

            {stateDraftRows.map((row) => (
                <div key={row.id} style={{ borderTop: `1px solid ${t.border.subtle}`, display: 'grid', gap: `${6 * uiScale}px`, gridTemplateColumns: '160px 1fr auto auto', padding: `${6 * uiScale}px 0` }}>
                    <input
                        onChange={(event) => {
                            const next = event.target.value;
                            setStateDraftRows((rows) => rows.map((candidate) => (candidate.id === row.id ? { ...candidate, key: next } : candidate)));
                            markDirty();
                        }}
                        placeholder="state key"
                        style={inputStyle(uiScale)}
                        type="text"
                        value={row.key}
                    />

                    <StateValueEditor
                        onChange={(next) => {
                            setStateDraftRows((rows) => rows.map((candidate) => (candidate.id === row.id ? { ...candidate, valueText: next } : candidate)));
                            markDirty();
                        }}
                        uiScale={uiScale}
                        valueText={row.valueText}
                    />

                    <button
                        className="toolbar-btn"
                        onClick={() => {
                            onApplyStateRow(row.id);
                        }}
                        style={{ padding: `${4 * uiScale}px` }}
                        title="Apply this row"
                    >
                        <Zap size={12 * uiScale} />
                    </button>

                    <button
                        className="toolbar-btn"
                        onClick={() => {
                            setStateDraftRows((rows) => rows.filter((candidate) => candidate.id !== row.id));
                            markDirty();
                        }}
                        style={{ padding: `${4 * uiScale}px` }}
                        title="Remove state row"
                    >
                        <Trash2 size={12 * uiScale} />
                    </button>
                </div>
            ))}
        </section>
    );
}

function inputStyle(uiScale: number): CSSProperties {
    return {
        background: t.bg.input,
        border: `1px solid ${t.border.input}`,
        borderRadius: t.radius.sm,
        color: t.text.primary,
        fontSize: `${11 * uiScale}px`,
        minWidth: 0,
        padding: `${4 * uiScale}px ${6 * uiScale}px`,
        width: '100%',
    };
}

function sectionStyle(uiScale: number): CSSProperties {
    return {
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.md,
        marginBottom: `${10 * uiScale}px`,
        padding: `${8 * uiScale}px`,
    };
}

function StateValueEditor({ onChange, uiScale, valueText }: { onChange: (next: string) => void; uiScale: number; valueText: string; }) {
    const kind = detectDraftValueKind(valueText);
    let valueEditor: ReactElement;

    switch (kind) {
        case 'boolean': {
            valueEditor = (
                <select
                    onChange={(event) => onChange(event.target.value === 'true' ? 'true' : 'false')}
                    style={inputStyle(uiScale)}
                    value={valueText === 'true' ? 'true' : 'false'}
                >
                    <option value="true">true</option>
                    <option value="false">false</option>
                </select>
            );
            break;
        }
        case 'json': {
            valueEditor = <textarea onChange={(event) => onChange(event.target.value)} rows={2} style={textareaStyle(uiScale)} value={valueText} />;
            break;
        }
        case 'null': {
            valueEditor = <div style={{ color: t.text.faint, fontStyle: 'italic', padding: `${4 * uiScale}px 0` }}>null</div>;
            break;
        }
        case 'number': {
            valueEditor = <input onChange={(event) => onChange(event.target.value)} style={inputStyle(uiScale)} type="number" value={valueText} />;
            break;
        }
        case 'string': {
            valueEditor = (
                <input
                    onChange={(event) => onChange(JSON.stringify(event.target.value))}
                    style={inputStyle(uiScale)}
                    type="text"
                    value={safeStringValue(valueText)}
                />
            );
            break;
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${4 * uiScale}px` }}>
            <div style={{ alignItems: 'center', display: 'flex', gap: `${6 * uiScale}px` }}>
                <span style={{ color: t.text.muted }}>Type</span>
                <select
                    onChange={(event) => onChange(defaultValueForKind(event.target.value as DraftValueKind))}
                    style={{ ...inputStyle(uiScale), maxWidth: 130, padding: `${2 * uiScale}px ${6 * uiScale}px` }}
                    value={kind}
                >
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="null">null</option>
                    <option value="json">json</option>
                </select>
            </div>

            {valueEditor}
        </div>
    );
}

function textareaStyle(uiScale: number): CSSProperties {
    return {
        ...inputStyle(uiScale),
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        resize: 'vertical',
    };
}

