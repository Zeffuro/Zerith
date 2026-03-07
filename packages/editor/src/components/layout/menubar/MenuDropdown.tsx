import { editorTheme as t } from '../../../theme/editorTheme';

export type MenuItem = {
    label: string;
    shortcut?: string;
    onClick?: () => void;
    disabled?: boolean;
    danger?: boolean;
    separator?: boolean;
    submenuLabel?: string;
};

export function MenuDropdown({
                                 uiScale,
                                 items,
                                 minWidth = 220,
                             }: {
    uiScale: number;
    items: MenuItem[];
    minWidth?: number;
}) {
    return (
        <div
            className="zerith-scrollbar"
            role="menu"
            style={{
                minWidth: `${minWidth * uiScale}px`,
                maxHeight: `${420 * uiScale}px`,
                overflowY: 'auto',
                background: t.bg.popup,
                border: `1px solid ${t.border.normal}`,
                borderRadius: t.radius.md,
                boxShadow: t.shadow.popupStrong,
                padding: `${6 * uiScale}px`,
                zIndex: 4000,
            }}
        >
            {items.map((item, idx) => {
                if (item.separator) {
                    return (
                        <div
                            key={`sep-${idx}`}
                            style={{
                                height: 1,
                                background: t.border.subtle,
                                margin: `${6 * uiScale}px ${4 * uiScale}px`,
                            }}
                        />
                    );
                }

                const disabled = !!item.disabled;
                return (
                    <button
                        key={`${item.label}-${idx}`}
                        type="button"
                        role="menuitem"
                        disabled={disabled}
                        onClick={() => {
                            if (!disabled) item.onClick?.();
                        }}
                        style={{
                            width: '100%',
                            border: 'none',
                            background: 'transparent',
                            color: disabled
                                ? t.text.faint
                                : item.danger
                                    ? t.accent.red
                                    : t.text.normal,
                            textAlign: 'left',
                            borderRadius: t.radius.sm,
                            padding: `${6 * uiScale}px ${8 * uiScale}px`,
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            display: 'grid',
                            gridTemplateColumns: '1fr auto',
                            alignItems: 'center',
                            gap: `${10 * uiScale}px`,
                            fontSize: `${12 * uiScale}px`,
                        }}
                        onMouseEnter={(e) => {
                            if (!disabled) e.currentTarget.style.background = 'var(--editor-bg-hover)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                        }}
                    >
                        <span>{item.label}</span>
                        <span style={{ color: t.text.muted, fontSize: `${11 * uiScale}px` }}>
                            {item.submenuLabel ? `${item.submenuLabel} ›` : item.shortcut ?? ''}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}