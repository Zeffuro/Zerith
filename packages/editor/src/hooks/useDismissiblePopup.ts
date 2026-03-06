import { useEffect, type RefObject } from 'react';

export function useDismissiblePopup(
    open: boolean,
    rootRef: RefObject<HTMLElement | null>,
    onClose: () => void
) {
    useEffect(() => {
        if (!open) return;

        const onDocClick = (e: MouseEvent) => {
            const el = rootRef.current;
            if (!el) return;
            if (!el.contains(e.target as Node)) onClose();
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open, rootRef, onClose]);
}