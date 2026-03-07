import { useEffect } from 'react';

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

export function ConfirmDialog({
                                  open,
                                  title = 'Confirm',
                                  message,
                                  confirmText = 'Confirm',
                                  cancelText = 'Cancel',
                                  danger = false,
                                  onConfirm,
                                  onCancel,
                              }: Props) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
            if (e.key === 'Enter') onConfirm();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onCancel, onConfirm]);

    if (!open) return null;

    return (
        <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'grid', placeItems: 'center', zIndex: 2000 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: 380, background: '#1b1f27', border: '1px solid #2b3240', borderRadius: 10, padding: 16, color: '#dbe3f0' }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
                <div style={{ opacity: .9, marginBottom: 14 }}>{message}</div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={onCancel}>{cancelText}</button>
                    <button onClick={onConfirm} style={{ color: '#fff', background: danger ? '#dc2626' : '#2563eb' }}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}