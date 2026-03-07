import { useEffect, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useScriptStore } from '../../store/useScriptStore';
import { useEditorStore } from '../../store/useEditorStore';
import { editorTheme as t } from '../../theme/editorTheme';

export function MacroHeaderInspector({}: { node: any; index?: number | null }) {
    const uiScale = useEditorStore((s) => s.uiScale);
    const selectedNodePath = useScriptStore((s) => s.selectedNodePath);

    const macroEntries = useProjectStore((s) => s.macroEntries);
    const renameMacroEntry = useProjectStore((s) => s.renameMacroEntry);
    const removeMacroEntry = useProjectStore((s) => s.removeMacroEntry);
    const duplicateMacroEntries = useProjectStore((s) => s.duplicateMacroEntries);

    const idx = typeof selectedNodePath?.[0] === 'number' ? (selectedNodePath[0] as number) : null;
    const macro = idx !== null ? macroEntries[idx] : null;

    const [name, setName] = useState(macro?.name ?? '');
    useEffect(() => setName(macro?.name ?? ''), [macro?.name]);

    if (idx === null || !macro) {
        return <div style={{ color: t.text.faint, fontStyle: 'italic' }}>Select a macro header.</div>;
    }

    const inputStyle = {
        width: '100%',
        padding: `${8 * uiScale}px`,
        backgroundColor: t.bg.input,
        border: `1px solid ${t.border.input}`,
        color: t.text.primary,
        borderRadius: t.radius.md,
        fontSize: 'inherit',
        outline: 'none',
    };

    const btn = {
        border: `1px solid ${t.border.button}`,
        background: t.bg.panel,
        color: t.text.normal,
        borderRadius: t.radius.sm,
        padding: `${6 * uiScale}px ${10 * uiScale}px`,
        cursor: 'pointer',
        fontSize: `${12 * uiScale}px`,
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${12 * uiScale}px` }}>
            <div>
                <label style={{ display: 'block', marginBottom: `${6 * uiScale}px`, color: t.text.muted, fontSize: '0.85em' }}>
                    Macro Name
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => renameMacroEntry(idx, name)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            renameMacroEntry(idx, name);
                            (e.target as HTMLInputElement).blur();
                        }
                    }}
                    style={inputStyle}
                />
            </div>

            <div style={{ display: 'flex', gap: `${8 * uiScale}px` }}>
                <button style={btn} onClick={() => duplicateMacroEntries([idx])}>
                    Duplicate Macro
                </button>
                <button
                    style={{ ...btn, color: '#fecaca', border: '1px solid #7f1d1d' }}
                    onClick={() => removeMacroEntry(idx)}
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