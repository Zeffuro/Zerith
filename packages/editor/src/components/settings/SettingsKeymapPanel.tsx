import { type RefObject } from 'react';

import { type GlobalShortcutCommand } from '../../services/keymapRegistry';
import { editorTheme as t } from '../../theme/editorTheme';
import { formatActionLabel, formatShortcutChordLabel, SettingsKeymapRow } from './SettingsKeymapRow';

type KeymapConflictEntry = {
    actions: GlobalShortcutCommand[];
    shortcut: string;
};

type KeymapRowView = {
    action: GlobalShortcutCommand;
    conflictsWith: GlobalShortcutCommand[];
    defaultShortcut: string;
    effectiveShortcut: string;
    isCustomized: boolean;
};

type SettingsKeymapPanelProperties = {
    activeConflictIndex: number;
    conflictActionSequenceLength: number;
    conflictCount: number;
    conflictEntries: KeymapConflictEntry[];
    filteredKeymapRows: KeymapRowView[];
    focusedRowAction: GlobalShortcutCommand | undefined;
    onFixAllConflicts: () => void;
    onFocusActionRow: (action: GlobalShortcutCommand) => void;
    onJumpToConflict: (direction: 'next' | 'previous') => void;
    onRequestResetAllDefaults: () => void;
    onRequestResetShortcut: (action: GlobalShortcutCommand) => void;
    onResolveConflictForAction: (action: GlobalShortcutCommand) => void;
    onSetRowReference: (action: GlobalShortcutCommand, element: HTMLDivElement | null) => void;
    onSetShowCustomizedOnly: (nextValue: boolean) => void;
    onUpdateShortcut: (action: GlobalShortcutCommand, nextValue: string) => void;
    rowsContainerReference: RefObject<HTMLDivElement | null>;
    showCustomizedOnly: boolean;
    uiScale: number;
};

export function SettingsKeymapPanel({
    activeConflictIndex,
    conflictActionSequenceLength,
    conflictCount,
    conflictEntries,
    filteredKeymapRows,
    focusedRowAction,
    onFixAllConflicts,
    onFocusActionRow,
    onJumpToConflict,
    onRequestResetAllDefaults,
    onRequestResetShortcut,
    onResolveConflictForAction,
    onSetRowReference,
    onSetShowCustomizedOnly,
    onUpdateShortcut,
    rowsContainerReference,
    showCustomizedOnly,
    uiScale,
}: SettingsKeymapPanelProperties) {
    return (
        <div style={{ display: 'grid', gap: `${10 * uiScale}px`, padding: `${16 * uiScale}px` }}>
            <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                Click a shortcut field and press the full key combination you want.
            </div>
            <button
                onClick={onRequestResetAllDefaults}
                style={{
                    background: t.bg.popup,
                    border: `1px solid ${t.border.normal}`,
                    borderRadius: t.radius.md,
                    color: t.text.primary,
                    cursor: 'pointer',
                    fontSize: `${12 * uiScale}px`,
                    justifySelf: 'start',
                    padding: `${6 * uiScale}px ${10 * uiScale}px`,
                }}
            >
                Reset All To Defaults
            </button>
            <label style={{ alignItems: 'center', color: t.text.normal, display: 'inline-flex', fontSize: `${12 * uiScale}px`, gap: `${6 * uiScale}px` }}>
                <input
                    checked={showCustomizedOnly}
                    onChange={(event) => onSetShowCustomizedOnly(event.currentTarget.checked)}
                    type="checkbox"
                />
                Show customized only
            </label>
            {conflictCount > 0 ? (
                <div
                    style={{
                        background: t.bg.danger,
                        border: `1px solid ${t.border.accent}`,
                        borderRadius: t.radius.md,
                        color: t.text.primary,
                        display: 'grid',
                        fontSize: `${12 * uiScale}px`,
                        gap: `${10 * uiScale}px`,
                        padding: `${8 * uiScale}px ${10 * uiScale}px`,
                    }}
                >
                    <div style={{ alignItems: 'center', display: 'flex', gap: `${10 * uiScale}px`, justifyContent: 'space-between' }}>
                        <span>
                            {conflictCount} shortcut conflict{conflictCount === 1 ? '' : 's'} detected. Conflicting rows are highlighted.
                        </span>
                        <div style={{ alignItems: 'center', display: 'inline-flex', gap: `${6 * uiScale}px` }}>
                            <span style={{ color: t.text.muted, fontSize: `${11 * uiScale}px`, minWidth: `${70 * uiScale}px`, textAlign: 'right' }}>
                                {`${activeConflictIndex >= 0 ? activeConflictIndex + 1 : 0}/${conflictActionSequenceLength}`}
                            </span>
                            <button
                                onClick={() => onJumpToConflict('previous')}
                                style={{
                                    background: t.bg.popup,
                                    border: `1px solid ${t.border.normal}`,
                                    borderRadius: t.radius.md,
                                    color: t.text.primary,
                                    cursor: 'pointer',
                                    fontSize: `${12 * uiScale}px`,
                                    padding: `${5 * uiScale}px ${9 * uiScale}px`,
                                    whiteSpace: 'nowrap',
                                }}
                                title="Previous conflict (Shift+F7)"
                            >
                                Prev
                            </button>
                            <button
                                onClick={() => onJumpToConflict('next')}
                                style={{
                                    background: t.bg.popup,
                                    border: `1px solid ${t.border.normal}`,
                                    borderRadius: t.radius.md,
                                    color: t.text.primary,
                                    cursor: 'pointer',
                                    fontSize: `${12 * uiScale}px`,
                                    padding: `${5 * uiScale}px ${9 * uiScale}px`,
                                    whiteSpace: 'nowrap',
                                }}
                                title="Next conflict (F7)"
                            >
                                Next
                            </button>
                            <button
                                onClick={onFixAllConflicts}
                                style={{
                                    background: t.bg.popup,
                                    border: `1px solid ${t.accent.red}`,
                                    borderRadius: t.radius.md,
                                    color: t.accent.red,
                                    cursor: 'pointer',
                                    fontSize: `${12 * uiScale}px`,
                                    padding: `${5 * uiScale}px ${9 * uiScale}px`,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                Fix All
                            </button>
                        </div>
                    </div>
                    <div className="zerith-scrollbar" style={{ display: 'grid', gap: `${6 * uiScale}px`, maxHeight: `${96 * uiScale}px`, overflow: 'auto', overscrollBehavior: 'contain' }}>
                        {conflictEntries.map((entry) => (
                            <div key={entry.shortcut} style={{ alignItems: 'center', display: 'grid', gap: `${8 * uiScale}px`, gridTemplateColumns: '140px 1fr', lineHeight: 1.2 }}>
                                <strong style={{ fontSize: `${12 * uiScale}px` }}>{formatShortcutChordLabel(entry.shortcut)}</strong>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${6 * uiScale}px` }}>
                                    {entry.actions.map((action) => (
                                        <button
                                            key={action}
                                            onClick={() => onFocusActionRow(action)}
                                            style={{
                                                background: t.bg.popup,
                                                border: `1px solid ${t.border.normal}`,
                                                borderRadius: t.radius.sm,
                                                color: t.text.primary,
                                                cursor: 'pointer',
                                                fontSize: `${11 * uiScale}px`,
                                                padding: `${3 * uiScale}px ${7 * uiScale}px`,
                                            }}
                                            title="Scroll to row"
                                        >
                                            {formatActionLabel(action)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : undefined}
            <div className="zerith-scrollbar" ref={rowsContainerReference} style={{ display: 'grid', gap: `${8 * uiScale}px`, maxHeight: `${420 * uiScale}px`, overflow: 'auto', overscrollBehavior: 'contain' }}>
                {filteredKeymapRows.length === 0 ? (
                    <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                        No keymap shortcuts match this search.
                    </div>
                ) : (
                    filteredKeymapRows.map((row) => (
                        <SettingsKeymapRow
                            action={row.action}
                            conflictsWith={row.conflictsWith}
                            defaultKey={row.defaultShortcut}
                            isCustomized={row.isCustomized}
                            isFocused={focusedRowAction === row.action}
                            key={row.action}
                            onReset={() => onRequestResetShortcut(row.action)}
                            onResolveConflict={() => onResolveConflictForAction(row.action)}
                            onUpdate={(nextValue) => onUpdateShortcut(row.action, nextValue)}
                            rowReference={(element) => onSetRowReference(row.action, element)}
                            uiScale={uiScale}
                            value={row.effectiveShortcut}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

