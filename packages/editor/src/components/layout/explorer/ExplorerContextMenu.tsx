import { editorTheme as t } from '../../../theme/editorTheme';

export type ExplorerMenuAction =
    | 'open'
    | 'openJson'
    | 'openTimeline'
    | 'newFile'
    | 'newFolder'
    | 'rename'
    | 'delete'
    | 'reveal';

export type ExplorerContextMenuState = {
    x: number;
    y: number;
    isDirectory: boolean;
    path: string;
    name: string;
    onAction: (action: ExplorerMenuAction) => void;
    onClose: () => void;
} | null;

export function ExplorerContextMenu({ uiScale, menu }: { uiScale: number; menu: ExplorerContextMenuState }) {
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

    const Row = ({ label, action, disabled = false }: { label: string; action: ExplorerMenuAction; disabled?: boolean }) => (
        <button
            type="button"
            disabled={disabled}
            style={{ ...itemStyle, color: disabled ? t.text.faint : t.text.normal, cursor: disabled ? 'not-allowed' : 'pointer' }}
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
                zIndex: 7000,
                minWidth: `${220 * uiScale}px`,
                background: t.bg.popup,
                border: `1px solid ${t.border.normal}`,
                borderRadius: t.radius.md,
                boxShadow: t.shadow.popupStrong,
                padding: `${6 * uiScale}px`,
            }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <Row label="Open" action="open" disabled={menu.isDirectory} />
            {!menu.isDirectory && (
                <>
                    <Row label="Open in JSON View" action="openJson" />
                    <Row label="Open in Timeline View" action="openTimeline" />
                </>
            )}

            <div style={{ height: 1, background: t.border.subtle, margin: `${6 * uiScale}px 0` }} />

            <Row label="New File…" action="newFile" />
            <Row label="New Folder…" action="newFolder" />
            <Row label="Rename…" action="rename" />
            <Row label="Delete…" action="delete" />
            <Row label="Reveal in File Manager" action="reveal" />
        </div>
    );
}