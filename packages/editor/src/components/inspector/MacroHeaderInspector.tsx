import { useEffect, useState } from 'react';

import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useScriptStore } from '../../store/useScriptStore';
import { editorTheme as t } from '../../theme/editorTheme';

export function MacroHeaderInspector(_properties: { index?: null | number; node: unknown; }) {
    const uiScale = useEditorStore((s) => s.uiScale);
    const selectedNodePath = useScriptStore((s) => s.selectedNodePath);

    const macroEntries = useProjectStore((s) => s.macroEntries);
    const renameMacroEntry = useProjectStore((s) => s.renameMacroEntry);
    const removeMacroEntry = useProjectStore((s) => s.removeMacroEntry);
    const duplicateMacroEntries = useProjectStore((s) => s.duplicateMacroEntries);

    const index = typeof selectedNodePath?.[0] === 'number' ? (selectedNodePath[0]) : undefined;
    const macro = index === undefined ? undefined : macroEntries[index];

    const currentName = macro?.name ?? '';
    const [name, setName] = useState(currentName);
    const [previousName, setPreviousName] = useState(currentName);

    if (currentName !== previousName) {
        setPreviousName(currentName);
        setName(currentName);
    }

    if (index === undefined || !macro) {
        return <div style={{ color: t.text.faint, fontStyle: 'italic' }}>Select a macro header.</div>;
    }

    const inputStyle = {
        backgroundColor: t.bg.input,
        border: `1px solid ${t.border.input}`,
        borderRadius: t.radius.md,
        color: t.text.primary,
        fontSize: 'inherit',
        outline: 'none',
        padding: `${8 * uiScale}px`,
        width: '100%',
    };

    const button = {
        background: t.bg.panel,
        border: `1px solid ${t.border.button}`,
        borderRadius: t.radius.sm,
        color: t.text.normal,
        cursor: 'pointer',
        fontSize: `${12 * uiScale}px`,
        padding: `${6 * uiScale}px ${10 * uiScale}px`,
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${12 * uiScale}px` }}>
            <div>
                <label style={{ color: t.text.muted, display: 'block', fontSize: '0.85em', marginBottom: `${6 * uiScale}px` }}>
                    Macro Name
                </label>
                <input
                    onBlur={() => renameMacroEntry(index, name)}
                    onChange={(event) => setName(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            renameMacroEntry(index, name);
                        }
                    }}
                    style={inputStyle}
                    type="text"
                    value={name}
                />
            </div>

            <div style={{ display: 'flex', gap: `${8 * uiScale}px` }}>
                <button onClick={() => duplicateMacroEntries([index])} style={button}>
                    Duplicate Macro
                </button>
                <button
                    onClick={() => removeMacroEntry(index)}
                    style={{ ...button, border: '1px solid #7f1d1d', color: '#fecaca' }}
                >
                    Delete Macro
                </button>
            </div>

            <div style={{ color: t.text.faint, fontSize: '0.85em' }}>
                Tip: drag macro headers in timeline to reorder.
            </div>
        </div>
    );
}