import type { ReactNode } from 'react';

import { editorTheme as t } from '../../../theme/editorTheme';

export function MenuButton({
                               active,
                               children,
                               label,
                               onClick,
                               onMouseEnter,
                               uiScale,
                           }: {
    active: boolean;
    children?: ReactNode;
    label: string;
    onClick: () => void;
    onMouseEnter?: () => void;
    uiScale: number;
}) {
    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={onClick}
                onMouseEnter={onMouseEnter}
                style={{
                    background: active ? t.bg.hover : 'transparent',
                    border: 'none',
                    borderRadius: t.radius.sm,
                    color: active ? t.text.primary : t.text.normal,
                    cursor: 'pointer',
                    fontSize: `${12 * uiScale}px`,
                    lineHeight: 1.2,
                    padding: `${4 * uiScale}px ${8 * uiScale}px`,
                }}
                type="button"
            >
                {label}
            </button>
            {active && (
                <div
                    style={{
                        left: 0,
                        position: 'absolute',
                        top: `calc(100% + ${4 * uiScale}px)`,
                    }}
                >
                    {children}
                </div>
            )}
        </div>
    );
}