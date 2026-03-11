import { type RefObject, useEffect, useRef } from 'react';

export function useDismissiblePopup(
    open: boolean,
    rootReference: RefObject<HTMLElement | null>,
    onClose: () => void
) {
    const onCloseReference = useRef(onClose);

    useEffect(() => {
        onCloseReference.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!open) return;

        const onDocumentClick = (event: MouseEvent) => {
            const element = rootReference.current;
            if (!element) return;
            if (!element.contains(event.target as Node)) onCloseReference.current();
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onCloseReference.current();
        };

        document.addEventListener('mousedown', onDocumentClick);
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('mousedown', onDocumentClick);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open, rootReference]);
}