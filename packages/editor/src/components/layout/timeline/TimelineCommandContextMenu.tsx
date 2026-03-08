import { editorTheme as t } from '../../../theme/editorTheme';
import { type CSSProperties, type MouseEvent } from 'react';

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

const ContextRow = ({
    action,
    disabled = false,
    label,
    menu,
    itemStyle,
    disabledStyle,
}: {
    action: Action;
    disabled?: boolean;
    label: string;
    menu: NonNullable<CommandContextMenuState>;
    itemStyle: CSSProperties;
    disabledStyle: CSSProperties;
}) => (
    <button
        disabled={disabled}
        onClick={() => {
            if (disabled) return;
            menu.onAction(action);
            menu.onClose();
        }}
        onMouseEnter={(e: MouseEvent<HTMLButtonElement>) => {
            if (!disabled) e.currentTarget.style.background = t.bg.hover;
        }}
        onMouseLeave={(e: MouseEvent<HTMLButtonElement>) => {
            e.currentTarget.style.background = 'transparent';
        }}
        style={disabled ? disabledStyle : itemStyle}
        type="button"
    >
        {label}
    </button>
);

export function TimelineCommandContextMenu({
                                               menu,
                                               uiScale,
                                           }: {
    menu: CommandContextMenuState;
    uiScale: number;
}) {
    if (!menu) return null;

    const itemStyle: CSSProperties = {
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

    const disabledStyle: CSSProperties = {
        ...itemStyle,
        color: t.text.faint,
        cursor: 'not-allowed',
    };

    return (
        <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
                background: t.bg.popup,
                border: `1px solid ${t.border.subtle}`,
                borderRadius: t.radius.md,
                boxShadow: t.shadow.contextMenu,
                display: 'flex',
                filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))',
                flexDirection: 'column',
                left: menu.x,
                padding: `${4 * uiScale}px`,
                position: 'fixed',
                top: menu.y,
                width: `${180 * uiScale}px`,
                zIndex: 9999,
            }}
        >
            <ContextRow action="copy" disabledStyle={disabledStyle} itemStyle={itemStyle} label="Copy" menu={menu} />
            <ContextRow action="paste" disabled={!menu.canPaste} disabledStyle={disabledStyle} itemStyle={itemStyle} label="Paste After" menu={menu} />
            <ContextRow action="duplicate" disabledStyle={disabledStyle} itemStyle={itemStyle} label="Duplicate" menu={menu} />
            <ContextRow action="delete" disabledStyle={disabledStyle} itemStyle={itemStyle} label="Delete" menu={menu} />
            <div style={{ background: t.border.subtle, height: 1, margin: `${6 * uiScale}px 0` }} />
            <ContextRow action="addAfter" disabledStyle={disabledStyle} itemStyle={itemStyle} label="Add Command After" menu={menu} />
            <ContextRow action="playFrom" disabled={!menu.canPlayFrom} disabledStyle={disabledStyle} itemStyle={itemStyle} label="Play From Here" menu={menu} />
        </div>
    );
}