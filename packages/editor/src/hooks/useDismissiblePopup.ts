import { type RefObject, useEffect } from 'react';

export function useDismissiblePopup(
    open: boolean,
    rootReference: RefObject<HTMLElement | null>,
    onClose: () => void
) {
    useEffect(() => {
        if (!open) return;

        const onDocumentClick = (e: MouseEvent) => {
            const element = rootReference.current;
            if (!element) return;
            if (!element.contains(e.target as Node)) onClose();
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('mousedown', onDocumentClick);
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('mousedown', onDocumentClick);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open, rootReference, onClose]);
}