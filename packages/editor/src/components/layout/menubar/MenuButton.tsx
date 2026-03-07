import type { ReactNode } from 'react';
import { editorTheme as t } from '../../../theme/editorTheme';

export function MenuButton({
                               uiScale,
                               label,
                               active,
                               onClick,
                               children,
                           }: {
    uiScale: number;
    label: string;
    active: boolean;
    onClick: () => void;
    children?: ReactNode;
}) {
    return (
        <div style={{ position: 'relative' }}>
            <button
                type="button"
                onClick={onClick}
                style={{
                    border: 'none',
                    background: active ? t.bg.hover : 'transparent',
                    color: active ? t.text.primary : t.text.normal,
                    padding: `${4 * uiScale}px ${8 * uiScale}px`,
                    borderRadius: t.radius.sm,
                    cursor: 'pointer',
                    fontSize: `${12 * uiScale}px`,
                    lineHeight: 1.2,
                }}
            >
                {label}
            </button>
            {active && (
                <div
                    style={{
                        position: 'absolute',
                        top: `calc(100% + ${4 * uiScale}px)`,
                        left: 0,
                    }}
                >
                    {children}
                </div>
            )}
        </div>
    );
}