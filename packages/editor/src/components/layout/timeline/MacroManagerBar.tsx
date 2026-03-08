import { Copy, Trash2, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useEditorStore } from '../../../store/useEditorStore';
import { useProjectStore } from '../../../store/useProjectStore';
import { editorTheme as t } from '../../../theme/editorTheme';
import { executeMacroTimelineAction } from '../../../store/actions/macroTimelineActions';

export function MacroManagerBar({ uiScale }: { uiScale: number }) {
    const selectedNodePaths = useEditorStore((s) => s.selectedNodePaths);

    const macroEntries = useProjectStore((s) => s.macroEntries);
    const renameMacroEntry = useProjectStore((s) => s.renameMacroEntry);

    const selectedMacroIndex = useMemo(() => {
        const first = selectedNodePaths[0];
        if (!first || typeof first[0] !== 'number') return null;
        return first[0] as number;
    }, [selectedNodePaths]);

    const selectedMacro = selectedMacroIndex !== null ? macroEntries[selectedMacroIndex] : null;
    const [renameDraft, setRenameDraft] = useState('');

    const beginRename = () => {
        if (!selectedMacro) return;
        setRenameDraft(selectedMacro.name);
    };

    const applyRename = () => {
        if (selectedMacroIndex === null) return;
        renameMacroEntry(selectedMacroIndex, renameDraft);
    };

    const duplicateSelected = () => {
        executeMacroTimelineAction('duplicateSelected');
    };

    const deleteSelected = () => {
        executeMacroTimelineAction('deleteSelected');
    };

    const btnStyle = {
        border: `1px solid ${t.border.button}`,
        background: t.bg.panel,
        color: t.text.normal,
        borderRadius: t.radius.sm,
        padding: `${4 * uiScale}px ${8 * uiScale}px`,
        cursor: 'pointer',
        fontSize: `${11 * uiScale}px`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${4 * uiScale}px`,
    };

    return (
        <div
            style={{
                border: `1px solid ${t.border.subtle}`,
                borderRadius: t.radius.md,
                padding: `${6 * uiScale}px`,
                marginBottom: `${8 * uiScale}px`,
                display: 'flex',
                alignItems: 'center',
                gap: `${6 * uiScale}px`,
                background: t.bg.panel,
            }}
        >
            <span style={{ color: t.text.muted, fontSize: `${11 * uiScale}px` }}>Macro:</span>

            {selectedMacro ? (
                <>
                    <input
                        type="text"
                        value={renameDraft || selectedMacro.name}
                        onFocus={beginRename}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onBlur={applyRename}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                applyRename();
                                (e.target as HTMLInputElement).blur();
                            }
                        }}
                        style={{
                            flex: 1,
                            minWidth: 0,
                            border: `1px solid ${t.border.input}`,
                            background: t.bg.input,
                            color: t.text.primary,
                            borderRadius: t.radius.sm,
                            padding: `${4 * uiScale}px ${8 * uiScale}px`,
                            fontSize: `${12 * uiScale}px`,
                        }}
                        title="Rename macro"
                    />

                    <button type="button" onClick={applyRename} style={btnStyle} title="Rename">
                        <Pencil size={12 * uiScale} /> Rename
                    </button>

                    <button type="button" onClick={duplicateSelected} style={btnStyle} title="Duplicate macro">
                        <Copy size={12 * uiScale} /> Duplicate
                    </button>

                    <button
                        type="button"
                        onClick={deleteSelected}
                        style={{ ...btnStyle, color: '#fca5a5', border: `1px solid #7f1d1d` }}
                        title="Delete macro"
                    >
                        <Trash2 size={12 * uiScale} /> Delete
                    </button>
                </>
            ) : (
                <span style={{ color: t.text.faint, fontSize: `${11 * uiScale}px` }}>
                    Select a macro root row to manage it.
                </span>
            )}
        </div>
    );
}