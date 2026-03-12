import { useState } from 'react';

import { editorTheme as t } from '../../../theme/editorTheme';

export type MenuItem = {
    children?: MenuItem[];
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
                                 level = 0,
                                 minWidth = 220,
                                 onItemSelected,
                                 uiScale,
                             }: {
    items: MenuItem[];
    level?: number;
    minWidth?: number;
    onItemSelected?: () => void;
    uiScale: number;
}) {
    const [hoveredIndex, setHoveredIndex] = useState<number | undefined>();
    const [openSubmenu, setOpenSubmenu] = useState<{ index: number; x: number; y: number } | undefined>();

    return (
        <div
            role="menu"
            style={{
                background: t.bg.popup,
                border: `1px solid ${t.border.normal}`,
                borderRadius: t.radius.md,
                boxShadow: t.shadow.popupStrong,
                minWidth: `${minWidth * uiScale}px`,
                overflow: 'visible',
                padding: `${6 * uiScale}px`,
                zIndex: 4000,
            }}
        >
            <div
                className="zerith-scrollbar"
                onMouseLeave={() => {
                    setHoveredIndex(undefined);
                    setOpenSubmenu(undefined);
                }}
                style={{
                    maxHeight: `${420 * uiScale}px`,
                    overflowY: 'auto',
                }}
            >
                {items.map((item, index) => {
                    if (item.separator) {
                        return (
                            <div
                                key={`sep-${level}-${index}`}
                                style={{
                                    background: t.border.subtle,
                                    height: 1,
                                    margin: `${6 * uiScale}px ${4 * uiScale}px`,
                                }}
                            />
                        );
                    }

                    const disabled = !!item.disabled;
                    const hasChildren = Array.isArray(item.children) && item.children.length > 0;
                    const submenuOpen = openSubmenu?.index === index;

                    const openAnchoredSubmenu = (target: HTMLElement | null) => {
                        if (!hasChildren || disabled) return;
                        const bounds = target?.getBoundingClientRect();
                        if (!bounds) return;
                        setOpenSubmenu({
                            index,
                            x: bounds.right + (4 * uiScale),
                            y: bounds.top,
                        });
                    };

                    return (
                        <div
                            key={`${item.label}-${level}-${index}`}
                            onMouseEnter={(event) => {
                                setHoveredIndex(index);
                                if (hasChildren) {
                                    openAnchoredSubmenu(event.currentTarget.querySelector('button'));
                                } else {
                                    setOpenSubmenu(undefined);
                                }
                            }}
                            style={{ position: 'relative' }}
                        >
                            <button
                                aria-expanded={hasChildren ? submenuOpen : undefined}
                                aria-haspopup={hasChildren ? 'menu' : undefined}
                                disabled={disabled}
                                onClick={(event) => {
                                    if (disabled) return;

                                    if (hasChildren) {
                                        if (submenuOpen) {
                                            setOpenSubmenu(undefined);
                                        } else {
                                            openAnchoredSubmenu(event.currentTarget);
                                        }
                                        return;
                                    }

                                    item.onClick?.();
                                    onItemSelected?.();
                                }}
                                role="menuitem"
                                style={{
                                    alignItems: 'center',
                                    background: submenuOpen || hoveredIndex === index ? t.bg.hover : 'transparent',
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
                                    {hasChildren ? '›' : (item.shortcut ?? '')}
                                </span>
                            </button>

                            {hasChildren && submenuOpen && (
                                <div
                                    onMouseLeave={() => setOpenSubmenu(undefined)}
                                    style={{
                                        left: `${openSubmenu?.x ?? 0}px`,
                                        position: 'fixed',
                                        top: `${openSubmenu?.y ?? 0}px`,
                                        zIndex: 4500,
                                    }}
                                >
                                    <MenuDropdown
                                        items={item.children ?? []}
                                        level={level + 1}
                                        onItemSelected={onItemSelected}
                                        uiScale={uiScale}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}