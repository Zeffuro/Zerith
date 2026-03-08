import { editorTheme as t } from '../../../theme/editorTheme';

export type MenuItem = {
    danger?: boolean;
    disabled?: boolean;
    label: string;
    onClick?: () => void;
    separator?: boolean;
    shortcut?: string;
    submenuLabel?: string;
};

export function MenuDropdown({
                                 items,
                                 minWidth = 220,
                                 uiScale,
                             }: {
    items: MenuItem[];
    minWidth?: number;
    uiScale: number;
}) {
    return (
        <div
            className="zerith-scrollbar"
            role="menu"
            style={{
                background: t.bg.popup,
                border: `1px solid ${t.border.normal}`,
                borderRadius: t.radius.md,
                boxShadow: t.shadow.popupStrong,
                maxHeight: `${420 * uiScale}px`,
                minWidth: `${minWidth * uiScale}px`,
                overflowY: 'auto',
                padding: `${6 * uiScale}px`,
                zIndex: 4000,
            }}
        >
            {items.map((item, index) => {
                if (item.separator) {
                    return (
                        <div
                            key={`sep-${index}`}
                            style={{
                                background: t.border.subtle,
                                height: 1,
                                margin: `${6 * uiScale}px ${4 * uiScale}px`,
                            }}
                        />
                    );
                }

                const disabled = !!item.disabled;
                return (
                    <button
                        disabled={disabled}
                        key={`${item.label}-${index}`}
                        onClick={() => {
                            if (!disabled) item.onClick?.();
                        }}
                        onMouseEnter={(event) => {
                            if (!disabled) event.currentTarget.style.background = 'var(--editor-bg-hover)';
                        }}
                        onMouseLeave={(event) => {
                            event.currentTarget.style.background = 'transparent';
                        }}
                        role="menuitem"
                        style={{
                            alignItems: 'center',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: t.radius.sm,
                            color: disabled
                                ? t.text.faint
                                : (item.danger
                                    ? t.accent.red
                                    : t.text.normal),
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            display: 'grid',
                            fontSize: `${12 * uiScale}px`,
                            gap: `${10 * uiScale}px`,
                            gridTemplateColumns: '1fr auto',
                            padding: `${6 * uiScale}px ${8 * uiScale}px`,
                            textAlign: 'left',
                            width: '100%',
                        }}
                        type="button"
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