import { useEffect, useId, useRef } from 'react';

import { useBackdropDismissal } from '../hooks/useBackdropDismissal';
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap';
import { useEditorStore } from '../store/useEditorStore';
import { editorTheme as t } from '../theme/editorTheme';
import { styles } from '../theme/styleHelpers';

type Properties = {
    cancelText?: string;
    confirmText?: string;
    danger?: boolean;
    extraActionDanger?: boolean;
    extraActionText?: string;
    message: string;
    onCancel: () => void;
    onConfirm: () => void;
    onExtraAction?: () => void;
    open: boolean;
    title?: string;
    zIndex?: number;
};

export function ConfirmDialog({ cancelText = 'Cancel', confirmText = 'Confirm', danger = false, extraActionDanger = false, extraActionText, message, onCancel, onConfirm, onExtraAction, open, title = 'Confirm', zIndex = 2000 }: Properties) {
    const uiScale = useEditorStore(s => s.uiScale);
    const dialogReference = useRef<HTMLDivElement | null>(null);
    const titleId = useId();
    const messageId = useId();

    useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onCancel();
            if (event.key === 'Enter') onConfirm();
        };
        globalThis.addEventListener('keydown', onKey);
        return () => globalThis.removeEventListener('keydown', onKey);
    },[open, onCancel, onConfirm]);
    useDialogFocusTrap({ active: open, containerReference: dialogReference });
    const backdropDismissal = useBackdropDismissal(onCancel);

    if (!open) return;

    return (
        <div {...backdropDismissal} style={{ background: 'rgba(0,0,0,.45)', display: 'grid', inset: 0, placeItems: 'center', position: 'fixed', zIndex }}>
            <div
                aria-describedby={messageId}
                aria-labelledby={titleId}
                aria-modal="true"
                onClick={(event) => event.stopPropagation()}
                ref={dialogReference}
                role="dialog"
                style={{
                    background: t.bg.panel,
                    border: `1px solid ${t.border.normal}`,
                    borderRadius: t.radius.lg,
                    boxShadow: t.shadow.popupStrong,
                    color: t.text.primary,
                    maxHeight: `calc(100vh - ${32 * uiScale}px)`,
                    overflow: 'hidden',
                    padding: `${16 * uiScale}px`,
                    width: `min(${560 * uiScale}px, calc(100vw - ${32 * uiScale}px))`,
                }}
                tabIndex={-1}
            >
                <div id={titleId} style={{ fontSize: `${14 * uiScale}px`, fontWeight: 700, marginBottom: `${8 * uiScale}px` }}>{title}</div>
                <div
                    className="zerith-scrollbar"
                    id={messageId}
                    style={{
                        color: t.text.normal,
                        fontSize: `${13 * uiScale}px`,
                        lineHeight: 1.5,
                        marginBottom: `${16 * uiScale}px`,
                        maxHeight: `min(52vh, ${360 * uiScale}px)`,
                        opacity: .9,
                        overflowWrap: 'anywhere',
                        overflowY: 'auto',
                        paddingRight: `${4 * uiScale}px`,
                        whiteSpace: 'pre-wrap',
                    }}
                >
                    {message}
                </div>
                <div style={{ display: 'flex', gap: `${8 * uiScale}px`, justifyContent: 'flex-end' }}>
                    {extraActionText && onExtraAction ? (
                        <button
                            onClick={onExtraAction}
                            style={{ ...styles.buttonBase(uiScale), background: extraActionDanger ? t.accent.red : undefined, border: extraActionDanger ? 'none' : undefined, color: extraActionDanger ? '#fff' : undefined }}
                            type="button"
                        >
                            {extraActionText}
                        </button>
                    ) : undefined}
                    <button onClick={onCancel} style={{ ...styles.buttonBase(uiScale) }} type="button">{cancelText}</button>
                    <button onClick={onConfirm} style={{ ...styles.buttonBase(uiScale), background: danger ? t.accent.red : t.accent.primary, border: 'none', color: '#fff' }} type="button">
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
