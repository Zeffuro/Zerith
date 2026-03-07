import { editorTheme as t } from '../../../theme/editorTheme';

type Action =
    | 'copy'
    | 'paste'
    | 'duplicate'
    | 'delete'
    | 'playFrom'
    | 'addAfter';

export type CommandContextMenuState = {
    x: number;
    y: number;
    canPlayFrom: boolean;
    canPaste: boolean;
    onAction: (action: Action) => void;
    onClose: () => void;
} | null;

export function TimelineCommandContextMenu({
                                               uiScale,
                                               menu,
                                           }: {
    uiScale: number;
    menu: CommandContextMenuState;
}) {
    if (!menu) return null;

    const itemStyle: React.CSSProperties = {
        width: '100%',
        border: 'none',
        background: 'transparent',
        color: t.text.normal,
        textAlign: 'left',
        borderRadius: t.radius.sm,
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
        cursor: 'pointer',
        fontSize: `${12 * uiScale}px`,
    };

    const disabledStyle: React.CSSProperties = {
        ...itemStyle,
        color: t.text.faint,
        cursor: 'not-allowed',
    };

    const Row = ({
                     label,
                     action,
                     disabled = false,
                 }: {
        label: string;
        action: Action;
        disabled?: boolean;
    }) => (
        <button
            type="button"
    disabled={disabled}
    style={disabled ? disabledStyle : itemStyle}
    onClick={() => {
        if (disabled) return;
        menu.onAction(action);
        menu.onClose();
    }}
    onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = t.bg.hover;
    }}
    onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
    }}
>
    {label}
    </button>
);

    return (
        <div
            style={{
        position: 'fixed',
            top: menu.y,
            left: menu.x,
            zIndex: 6000,
            minWidth: `${200 * uiScale}px`,
            background: t.bg.popup,
            border: `1px solid ${t.border.normal}`,
            borderRadius: t.radius.md,
            boxShadow: t.shadow.popupStrong,
            padding: `${6 * uiScale}px`,
    }}
    onMouseDown={(e) => e.stopPropagation()}
>
    <Row label="Copy" action="copy" />
    <Row label="Paste After" action="paste" disabled={!menu.canPaste} />
    <Row label="Duplicate" action="duplicate" />
    <Row label="Delete" action="delete" />
    <div style={{ height: 1, background: t.border.subtle, margin: `${6 * uiScale}px 0` }} />
    <Row label="Add Command After" action="addAfter" />
    <Row label="Play From Here" action="playFrom" disabled={!menu.canPlayFrom} />
    </div>
);
}