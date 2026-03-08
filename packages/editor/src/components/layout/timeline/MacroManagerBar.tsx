import { Copy, Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { executeMacroTimelineAction } from '../../../store/actions/macroTimelineActions';
import { useEditorStore } from '../../../store/useEditorStore';
import { useProjectStore } from '../../../store/useProjectStore';
import { editorTheme as t } from '../../../theme/editorTheme';

export function MacroManagerBar({ uiScale }: { uiScale: number }) {
    const selectedNodePaths = useEditorStore((s) => s.selectedNodePaths);

    const macroEntries = useProjectStore((s) => s.macroEntries);
    const renameMacroEntry = useProjectStore((s) => s.renameMacroEntry);

    const selectedMacroIndex = useMemo(() => {
        const first = selectedNodePaths[0];
        if (!first || typeof first[0] !== 'number') return null;
        return first[0];
    }, [selectedNodePaths]);

    const selectedMacro = selectedMacroIndex === null ? null : macroEntries[selectedMacroIndex];
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

    const buttonStyle = {
        alignItems: 'center',
        background: t.bg.panel,
        border: `1px solid ${t.border.button}`,
        borderRadius: t.radius.sm,
        color: t.text.normal,
        cursor: 'pointer',
        display: 'inline-flex',
        fontSize: `${11 * uiScale}px`,
        gap: `${4 * uiScale}px`,
        padding: `${4 * uiScale}px ${8 * uiScale}px`,
    };

    return (
        <div
            style={{
                alignItems: 'center',
                background: t.bg.panel,
                border: `1px solid ${t.border.subtle}`,
                borderRadius: t.radius.md,
                display: 'flex',
                gap: `${6 * uiScale}px`,
                marginBottom: `${8 * uiScale}px`,
                padding: `${6 * uiScale}px`,
            }}
        >
            <span style={{ color: t.text.muted, fontSize: `${11 * uiScale}px` }}>Macro:</span>

            {selectedMacro ? (
                <>
                    <input
                        onBlur={applyRename}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onFocus={beginRename}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                applyRename();
                                (e.target as HTMLInputElement).blur();
                            }
                        }}
                        style={{
                            background: t.bg.input,
                            border: `1px solid ${t.border.input}`,
                            borderRadius: t.radius.sm,
                            color: t.text.primary,
                            flex: 1,
                            fontSize: `${12 * uiScale}px`,
                            minWidth: 0,
                            padding: `${4 * uiScale}px ${8 * uiScale}px`,
                        }}
                        title="Rename macro"
                        type="text"
                        value={renameDraft || selectedMacro.name}
                    />

                    <button onClick={applyRename} style={buttonStyle} title="Rename" type="button">
                        <Pencil size={12 * uiScale} /> Rename
                    </button>

                    <button onClick={duplicateSelected} style={buttonStyle} title="Duplicate macro" type="button">
                        <Copy size={12 * uiScale} /> Duplicate
                    </button>

                    <button
                        onClick={deleteSelected}
                        style={{ ...buttonStyle, border: `1px solid #7f1d1d`, color: '#fca5a5' }}
                        title="Delete macro"
                        type="button"
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