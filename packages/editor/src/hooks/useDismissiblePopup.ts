import { type RefObject, useEffect } from 'react';

export function useDismissiblePopup(
    open: boolean,
    rootReference: RefObject<HTMLElement | null>,
    onClose: () => void
) {
    useEffect(() => {
        if (!open) return;

        const onDocumentClick = (event: MouseEvent) => {
            const element = rootReference.current;
            if (!element) return;
            if (!element.contains(event.target as Node)) onClose();
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        document.addEventListener('mousedown', onDocumentClick);
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('mousedown', onDocumentClick);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open, rootReference, onClose]);
}