import { useEffect } from 'react';

import { useEditorStore } from '../store/useEditorStore';
import { editorTheme as t } from '../theme/editorTheme';

type Properties = {
    uiScale: number;
};

export function EditorLiveStatus({ uiScale }: Properties) {
    const clearOperationStatus = useEditorStore((state) => state.clearOperationStatus);
    const lastOperationStatus = useEditorStore((state) => state.lastOperationStatus);

    useEffect(() => {
        if (!lastOperationStatus) return;

        const timer = globalThis.setTimeout(clearOperationStatus, 8000);
        return () => globalThis.clearTimeout(timer);
    }, [clearOperationStatus, lastOperationStatus]);

    if (!lastOperationStatus) return;

    return (
        <div
            aria-atomic="true"
            aria-live="polite"
            role="status"
            style={{
                background: t.bg.popup,
                border: `1px solid ${statusBorderColor(lastOperationStatus.tone)}`,
                borderRadius: t.radius.md,
                bottom: `${16 * uiScale}px`,
                boxShadow: t.shadow.popup,
                color: t.text.normal,
                fontSize: `${12 * uiScale}px`,
                maxWidth: `min(${420 * uiScale}px, calc(100vw - ${32 * uiScale}px))`,
                padding: `${8 * uiScale}px ${10 * uiScale}px`,
                pointerEvents: 'none',
                position: 'fixed',
                right: `${16 * uiScale}px`,
                zIndex: 6200,
            }}
        >
            {lastOperationStatus.message}
        </div>
    );
}

function statusBorderColor(tone: 'error' | 'info' | 'success' | 'warning'): string {
    switch (tone) {
        case 'error': {
            return t.accent.red;
        }
        case 'info': {
            return t.border.normal;
        }
        case 'success': {
            return t.accent.green;
        }
        case 'warning': {
            return t.accent.orange;
        }
    }
}
