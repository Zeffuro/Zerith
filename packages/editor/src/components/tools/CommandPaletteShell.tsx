import type { ReactNode } from 'react';

import { editorTheme as t } from '../../theme/editorTheme';

type Properties = {
    children: ReactNode;
    onRequestClose: () => void;
    uiScale: number;
};

export function CommandPaletteShell({ children, onRequestClose, uiScale }: Properties) {
    return (
        <div
            onClick={onRequestClose}
            style={{
                alignItems: 'flex-start',
                background: 'rgba(0, 0, 0, 0.45)',
                display: 'flex',
                height: '100%',
                justifyContent: 'center',
                left: 0,
                position: 'absolute',
                top: 0,
                width: '100%',
                zIndex: 5200,
            }}
        >
            <div
                onClick={(event) => event.stopPropagation()}
                style={{
                    background: t.bg.popup,
                    border: `1px solid ${t.border.normal}`,
                    borderRadius: t.radius.md,
                    boxShadow: t.shadow.popupStrong,
                    marginTop: `${52 * uiScale}px`,
                    maxHeight: `min(70vh, ${560 * uiScale}px)`,
                    maxWidth: `min(92vw, ${820 * uiScale}px)`,
                    overflow: 'hidden',
                    width: `min(92vw, ${680 * uiScale}px)`,
                }}
            >
                {children}
            </div>
        </div>
    );
}

