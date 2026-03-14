import { type GlobalShortcutCommand } from '../../services/keymapRegistry';
import { parseShortcutChord, serializeShortcutChord, shortcutChordFromEvent } from '../../services/shortcutChord';
import { editorTheme as t } from '../../theme/editorTheme';

type SettingsKeymapRowProperties = {
    action: GlobalShortcutCommand;
    conflictsWith: GlobalShortcutCommand[];
    defaultKey: string;
    isCustomized: boolean;
    isFocused: boolean;
    onReset: () => void;
    onResolveConflict: () => void;
    onUpdate: (nextValue: string) => void;
    rowReference: (element: HTMLDivElement | null) => void;
    uiScale: number;
    value: string;
};

export function formatActionLabel(action: string): string {
    return action
        .replaceAll(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, (character) => character.toUpperCase());
}

export function formatShortcutChordLabel(rawValue: string): string {
    const parsed = parseShortcutChord(rawValue);
    if (!parsed) return rawValue;

    const parts = [
        parsed.requireMod ? 'Ctrl/Cmd' : undefined,
        parsed.requireAlt ? 'Alt' : undefined,
        parsed.requireShift ? 'Shift' : undefined,
        formatKeyLabel(parsed.key),
    ].filter((part): part is string => part !== undefined);

    return parts.join(' + ');
}

export function SettingsKeymapRow({
    action,
    conflictsWith,
    defaultKey,
    isCustomized,
    isFocused,
    onReset,
    onResolveConflict,
    onUpdate,
    rowReference,
    uiScale,
    value,
}: SettingsKeymapRowProperties) {
    const hasConflict = conflictsWith.length > 0;

    return (
        <div
            ref={rowReference}
            style={{
                alignItems: 'center',
                background: isCustomized ? t.bg.selected : t.bg.popup,
                border: `1px solid ${hasConflict ? t.accent.red : (isCustomized ? t.border.accent : t.border.subtle)}`,
                borderRadius: t.radius.md,
                boxShadow: isFocused ? `0 0 0 2px ${t.accent.primary}` : undefined,
                display: 'grid',
                gap: `${8 * uiScale}px`,
                gridTemplateColumns: '1.4fr 72px 1fr 56px 56px',
                padding: `${8 * uiScale}px ${10 * uiScale}px`,
            }}
        >
            <span style={{ color: t.text.primary, fontSize: `${12 * uiScale}px` }} title={hasConflict ? `Conflicts with: ${conflictsWith.map((conflict) => formatActionLabel(conflict)).join(', ')}` : undefined}>
                {formatActionLabel(action)}
                {hasConflict ? ' (conflict)' : ''}
            </span>
            <span
                style={{
                    alignItems: 'center',
                    background: t.accent.green,
                    borderRadius: t.radius.sm,
                    color: '#fff',
                    display: 'inline-flex',
                    fontSize: `${10 * uiScale}px`,
                    fontWeight: 700,
                    height: `${18 * uiScale}px`,
                    justifyContent: 'center',
                    letterSpacing: '.03em',
                    opacity: isCustomized ? 1 : 0,
                    pointerEvents: isCustomized ? 'auto' : 'none',
                    textTransform: 'uppercase',
                    visibility: isCustomized ? 'visible' : 'hidden',
                    width: '100%',
                }}
                title={isCustomized ? `Default: ${formatShortcutChordLabel(defaultKey)}` : undefined}
            >
                Custom
            </span>
            <input
                onKeyDown={(event) => {
                    if (event.key === 'Backspace' || event.key === 'Delete') {
                        event.preventDefault();
                        onUpdate('');
                        return;
                    }

                    const chord = shortcutChordFromEvent(event);
                    if (!chord) return;

                    event.preventDefault();
                    onUpdate(serializeShortcutChord(chord));
                }}
                placeholder="Press shortcut"
                readOnly
                style={{
                    background: t.bg.input,
                    border: `1px solid ${isCustomized ? t.border.accent : t.border.normal}`,
                    borderRadius: t.radius.md,
                    color: t.text.primary,
                    fontSize: `${12 * uiScale}px`,
                    padding: `${6 * uiScale}px ${8 * uiScale}px`,
                    width: '100%',
                }}
                value={formatShortcutChordLabel(value)}
            />
            <button
                onClick={onReset}
                style={{
                    background: t.bg.popup,
                    border: `1px solid ${t.border.normal}`,
                    borderRadius: t.radius.md,
                    color: t.text.primary,
                    cursor: 'pointer',
                    fontSize: `${12 * uiScale}px`,
                    padding: `${5 * uiScale}px ${8 * uiScale}px`,
                    width: '100%',
                }}
                title={`Reset to default (${formatShortcutChordLabel(defaultKey)})`}
            >
                Reset
            </button>
            <button
                onClick={onResolveConflict}
                style={{
                    background: t.bg.popup,
                    border: `1px solid ${hasConflict ? t.accent.red : t.border.normal}`,
                    borderRadius: t.radius.md,
                    color: hasConflict ? t.accent.red : t.text.muted,
                    cursor: hasConflict ? 'pointer' : 'default',
                    fontSize: `${12 * uiScale}px`,
                    opacity: hasConflict ? 1 : 0,
                    padding: `${5 * uiScale}px ${8 * uiScale}px`,
                    pointerEvents: hasConflict ? 'auto' : 'none',
                    visibility: hasConflict ? 'visible' : 'hidden',
                    width: '100%',
                }}
                title={hasConflict ? `Resolve by keeping ${formatActionLabel(action)} and clearing conflicting overrides` : undefined}
            >
                Fix
            </button>
        </div>
    );
}

function formatKeyLabel(value: string): string {
    if (value.length === 1) return value.toUpperCase();
    return value.replace(/^./, (character) => character.toUpperCase());
}

