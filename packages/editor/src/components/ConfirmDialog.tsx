import { useEffect } from 'react';
import { editorTheme as t } from '../theme/editorTheme';
import { styles } from '../theme/styleHelpers';
import { useEditorStore } from '../store/useEditorStore';

type Props = {
    open: boolean;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

export function ConfirmDialog({ open, title = 'Confirm', message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false, onConfirm, onCancel }: Props) {
    const uiScale = useEditorStore(s => s.uiScale);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
            if (e.key === 'Enter') onConfirm();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    },[open, onCancel, onConfirm]);

    if (!open) return null;

    return (
        <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'grid', placeItems: 'center', zIndex: 2000 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: `${380 * uiScale}px`, background: t.bg.panel, border: `1px solid ${t.border.normal}`, borderRadius: t.radius.lg, padding: `${16 * uiScale}px`, color: t.text.primary, boxShadow: t.shadow.popupStrong }}>
                <div style={{ fontWeight: 700, marginBottom: `${8 * uiScale}px`, fontSize: `${14 * uiScale}px` }}>{title}</div>
                <div style={{ opacity: .9, marginBottom: `${16 * uiScale}px`, fontSize: `${13 * uiScale}px`, color: t.text.normal }}>{message}</div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: `${8 * uiScale}px` }}>
                    <button onClick={onCancel} style={{ ...styles.buttonBase(uiScale) }}>{cancelText}</button>
                    <button onClick={onConfirm} style={{ ...styles.buttonBase(uiScale), color: '#fff', border: 'none', background: danger ? t.accent.red : t.accent.primary }}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
