import { editorTheme as t } from '../../../theme/editorTheme';

export type CommandContextMenuState = {
    canPaste: boolean;
    canPlayFrom: boolean;
    onAction: (action: Action) => void;
    onClose: () => void;
    x: number;
    y: number;
} | null;

type Action =
    | 'addAfter'
    | 'copy'
    | 'delete'
    | 'duplicate'
    | 'paste'
    | 'playFrom';

export function TimelineCommandContextMenu({
                                               menu,
                                               uiScale,
                                           }: {
    menu: CommandContextMenuState;
    uiScale: number;
}) {
    if (!menu) return null;

    const itemStyle: React.CSSProperties = {
        background: 'transparent',
        border: 'none',
        borderRadius: t.radius.sm,
        color: t.text.normal,
        cursor: 'pointer',
        fontSize: `${12 * uiScale}px`,
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
        textAlign: 'left',
        width: '100%',
    };

    const disabledStyle: React.CSSProperties = {
        ...itemStyle,
        color: t.text.faint,
        cursor: 'not-allowed',
    };

    const Row = ({
                     action,
                     disabled = false,
                     label,
                 }: {
        action: Action;
        disabled?: boolean;
        label: string;
    }) => (
        <button
            disabled={disabled}
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
    style={disabled ? disabledStyle : itemStyle}
    type="button"
>
    {label}
    </button>
);

    return (
        <div
            onMouseDown={(e) => e.stopPropagation()}
    style={{
        background: t.bg.popup,
            border: `1px solid ${t.border.normal}`,
            borderRadius: t.radius.md,
            boxShadow: t.shadow.popupStrong,
            left: menu.x,
            minWidth: `${200 * uiScale}px`,
            padding: `${6 * uiScale}px`,
            position: 'fixed',
            top: menu.y,
            zIndex: 6000,
    }}
>
    <Row action="copy" label="Copy" />
    <Row action="paste" disabled={!menu.canPaste} label="Paste After" />
    <Row action="duplicate" label="Duplicate" />
    <Row action="delete" label="Delete" />
    <div style={{ background: t.border.subtle, height: 1, margin: `${6 * uiScale}px 0` }} />
    <Row action="addAfter" label="Add Command After" />
    <Row action="playFrom" disabled={!menu.canPlayFrom} label="Play From Here" />
    </div>
);
}