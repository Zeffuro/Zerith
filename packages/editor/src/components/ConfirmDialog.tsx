import { useEffect } from 'react';

import { useEditorStore } from '../store/useEditorStore';
import { editorTheme as t } from '../theme/editorTheme';
import { styles } from '../theme/styleHelpers';

type Properties = {
    cancelText?: string;
    confirmText?: string;
    danger?: boolean;
    message: string;
    onCancel: () => void;
    onConfirm: () => void;
    open: boolean;
    title?: string;
};

export function ConfirmDialog({ cancelText = 'Cancel', confirmText = 'Confirm', danger = false, message, onCancel, onConfirm, open, title = 'Confirm' }: Properties) {
    const uiScale = useEditorStore(s => s.uiScale);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
            if (e.key === 'Enter') onConfirm();
        };
        globalThis.addEventListener('keydown', onKey);
        return () => globalThis.removeEventListener('keydown', onKey);
    },[open, onCancel, onConfirm]);

    if (!open) return null;

    return (
        <div onClick={onCancel} style={{ background: 'rgba(0,0,0,.45)', display: 'grid', inset: 0, placeItems: 'center', position: 'fixed', zIndex: 2000 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: t.bg.panel, border: `1px solid ${t.border.normal}`, borderRadius: t.radius.lg, boxShadow: t.shadow.popupStrong, color: t.text.primary, padding: `${16 * uiScale}px`, width: `${380 * uiScale}px` }}>
                <div style={{ fontSize: `${14 * uiScale}px`, fontWeight: 700, marginBottom: `${8 * uiScale}px` }}>{title}</div>
                <div style={{ color: t.text.normal, fontSize: `${13 * uiScale}px`, marginBottom: `${16 * uiScale}px`, opacity: .9 }}>{message}</div>
                <div style={{ display: 'flex', gap: `${8 * uiScale}px`, justifyContent: 'flex-end' }}>
                    <button onClick={onCancel} style={{ ...styles.buttonBase(uiScale) }}>{cancelText}</button>
                    <button onClick={onConfirm} style={{ ...styles.buttonBase(uiScale), background: danger ? t.accent.red : t.accent.primary, border: 'none', color: '#fff' }}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
