import { editorTheme as t } from '../../../theme/editorTheme';

export type ExplorerContextMenuState = {
    isDirectory: boolean;
    name: string;
    onAction: (action: ExplorerMenuAction) => void;
    onClose: () => void;
    path: string;
    x: number;
    y: number;
} | undefined;

export type ExplorerMenuAction =
    | 'delete'
    | 'newFile'
    | 'newFolder'
    | 'open'
    | 'openJson'
    | 'openTimeline'
    | 'rename'
    | 'reveal';

type ActionRowProperties = {
    action: ExplorerMenuAction;
    disabled?: boolean;
    itemStyle: React.CSSProperties;
    label: string;
    menu: Exclude<ExplorerContextMenuState, undefined>;
};

export function ExplorerContextMenu({ menu, uiScale }: { menu: ExplorerContextMenuState; uiScale: number; }) {
    if (!menu) return;

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

    return (
        <div
            onMouseDown={(event) => event.stopPropagation()}
            style={{
                background: t.bg.popup,
                border: `1px solid ${t.border.normal}`,
                borderRadius: t.radius.md,
                boxShadow: t.shadow.popupStrong,
                left: menu.x,
                minWidth: `${220 * uiScale}px`,
                padding: `${6 * uiScale}px`,
                position: 'fixed',
                top: menu.y,
                zIndex: 7000,
            }}
        >
            <ActionRow action="open" disabled={menu.isDirectory} itemStyle={itemStyle} label="Open" menu={menu} />
            {!menu.isDirectory && (
                <>
                    <ActionRow action="openJson" itemStyle={itemStyle} label="Open in JSON View" menu={menu} />
                    <ActionRow action="openTimeline" itemStyle={itemStyle} label="Open in Timeline View" menu={menu} />
                </>
            )}

            <div style={{ background: t.border.subtle, height: 1, margin: `${6 * uiScale}px 0` }} />

            <ActionRow action="newFile" itemStyle={itemStyle} label="New File…" menu={menu} />
            <ActionRow action="newFolder" itemStyle={itemStyle} label="New Folder…" menu={menu} />
            <ActionRow action="rename" itemStyle={itemStyle} label="Rename…" menu={menu} />
            <ActionRow action="delete" itemStyle={itemStyle} label="Delete…" menu={menu} />
            <ActionRow action="reveal" itemStyle={itemStyle} label="Reveal in File Manager" menu={menu} />
        </div>
    );
}

function ActionRow({ action, disabled = false, itemStyle, label, menu }: ActionRowProperties) {
    return (
        <button
            disabled={disabled}
            onClick={() => {
                if (disabled) return;
                menu.onAction(action);
                menu.onClose();
            }}
            onMouseEnter={(event) => {
                if (!disabled) event.currentTarget.style.background = t.bg.hover;
            }}
            onMouseLeave={(event) => {
                event.currentTarget.style.background = 'transparent';
            }}
            style={{ ...itemStyle, color: disabled ? t.text.faint : t.text.normal, cursor: disabled ? 'not-allowed' : 'pointer' }}
            type="button"
        >
            {label}
        </button>
    );
}