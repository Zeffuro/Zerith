import { editorTheme as t } from '../../../theme/editorTheme';

export type ExplorerContextMenuState = {
    isDirectory: boolean;
    name: string;
    onAction: (action: ExplorerMenuAction) => void;
    onClose: () => void;
    path: string;
    x: number;
    y: number;
} | null;

export type ExplorerMenuAction =
    | 'delete'
    | 'newFile'
    | 'newFolder'
    | 'open'
    | 'openJson'
    | 'openTimeline'
    | 'rename'
    | 'reveal';

export function ExplorerContextMenu({ menu, uiScale }: { menu: ExplorerContextMenuState; uiScale: number; }) {
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

    const Row = ({ action, disabled = false, label }: { action: ExplorerMenuAction; disabled?: boolean; label: string; }) => (
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
            style={{ ...itemStyle, color: disabled ? t.text.faint : t.text.normal, cursor: disabled ? 'not-allowed' : 'pointer' }}
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
                minWidth: `${220 * uiScale}px`,
                padding: `${6 * uiScale}px`,
                position: 'fixed',
                top: menu.y,
                zIndex: 7000,
            }}
        >
            <Row action="open" disabled={menu.isDirectory} label="Open" />
            {!menu.isDirectory && (
                <>
                    <Row action="openJson" label="Open in JSON View" />
                    <Row action="openTimeline" label="Open in Timeline View" />
                </>
            )}

            <div style={{ background: t.border.subtle, height: 1, margin: `${6 * uiScale}px 0` }} />

            <Row action="newFile" label="New File…" />
            <Row action="newFolder" label="New Folder…" />
            <Row action="rename" label="Rename…" />
            <Row action="delete" label="Delete…" />
            <Row action="reveal" label="Reveal in File Manager" />
        </div>
    );
}