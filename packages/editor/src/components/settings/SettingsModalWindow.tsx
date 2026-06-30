import {
    type MouseEvent as ReactMouseEvent,
    type ReactNode,
    useEffect,
    useRef,
    useState,
} from 'react';

import { useBackdropDismissal } from '../../hooks/useBackdropDismissal';
import { useDialogFocusTrap } from '../../hooks/useDialogFocusTrap';
import { editorTheme as t } from '../../theme/editorTheme';
import { clamp } from '../../utils/math';

export type SettingsModalWindowLayout = {
    beginDrag: (event: ReactMouseEvent<HTMLDivElement>) => void;
    modalHeight: number;
    modalWidth: number;
    sidebarWidth: number;
};

export type SettingsModalWindowProperties = {
    children: (layout: SettingsModalWindowLayout) => ReactNode;
    onBackdropClick: () => void;
    uiScale: number;
};

export function SettingsModalWindow({ children, onBackdropClick, uiScale }: SettingsModalWindowProperties) {
    const defaultModalWidth = Math.min(980 * uiScale, globalThis.innerWidth * 0.92);
    const defaultModalHeight = Math.min(560 * uiScale, globalThis.innerHeight * 0.9);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [modalSize, setModalSize] = useState({ height: defaultModalHeight, width: defaultModalWidth });
    const ignoreBackdropCloseUntilReference = useRef(0);
    const modalReference = useRef<HTMLDivElement | null>(null);
    const modalWidth = modalSize.width;
    const modalHeight = modalSize.height;
    const sidebarWidth = Math.min(260 * uiScale, Math.max(180, modalWidth * 0.38));

    useEffect(() => {
        globalThis.setTimeout(() => {
            setDragOffset({ x: 0, y: 0 });
        }, 0);
    }, [uiScale]);

    useEffect(() => {
        setModalSize(clampModalSize(defaultModalWidth, defaultModalHeight, uiScale));
    }, [defaultModalHeight, defaultModalWidth, uiScale]);

    useEffect(() => {
        const onResize = () => {
            setModalSize((current) => clampModalSize(current.width, current.height, uiScale));
            setDragOffset((current) => {
                const nextSize = clampModalSize(modalWidth, modalHeight, uiScale);
                return clampDragOffset(current.x, current.y, nextSize.width, nextSize.height);
            });
        };

        globalThis.addEventListener('resize', onResize);
        return () => globalThis.removeEventListener('resize', onResize);
    }, [modalHeight, modalWidth, uiScale]);

    const beginDrag = (event: ReactMouseEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        if ((event.target as HTMLElement).closest('[data-settings-close="true"]')) return;
        if ((event.target as HTMLElement).closest('[data-settings-resize-zone="true"]')) return;

        const dragStart = {
            originX: dragOffset.x,
            originY: dragOffset.y,
            startX: event.clientX,
            startY: event.clientY,
        };

        const onMouseMove = (moveEvent: MouseEvent) => {
            const nextOffset = clampDragOffset(
                dragStart.originX + (moveEvent.clientX - dragStart.startX),
                dragStart.originY + (moveEvent.clientY - dragStart.startY),
                modalWidth,
                modalHeight,
            );

            setDragOffset(nextOffset);
        };

        const onMouseUp = () => {
            globalThis.removeEventListener('mousemove', onMouseMove);
            globalThis.removeEventListener('mouseup', onMouseUp);
        };

        globalThis.addEventListener('mousemove', onMouseMove);
        globalThis.addEventListener('mouseup', onMouseUp);
    };

    const beginResize = (event: ReactMouseEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        ignoreBackdropCloseUntilReference.current = Date.now() + 250;

        const resizeStart = {
            originHeight: modalHeight,
            originWidth: modalWidth,
            startX: event.clientX,
            startY: event.clientY,
        };

        const onMouseMove = (moveEvent: MouseEvent) => {
            const nextWidth = resizeStart.originWidth + (moveEvent.clientX - resizeStart.startX);
            const nextHeight = resizeStart.originHeight + (moveEvent.clientY - resizeStart.startY);
            const nextSize = clampModalSize(nextWidth, nextHeight, uiScale);

            setModalSize(nextSize);
            setDragOffset((current) => clampDragOffset(current.x, current.y, nextSize.width, nextSize.height));
        };

        const onMouseUp = () => {
            ignoreBackdropCloseUntilReference.current = Date.now() + 250;
            globalThis.removeEventListener('mousemove', onMouseMove);
            globalThis.removeEventListener('mouseup', onMouseUp);
        };

        globalThis.addEventListener('mousemove', onMouseMove);
        globalThis.addEventListener('mouseup', onMouseUp);
    };

    const backdropDismissal = useBackdropDismissal(onBackdropClick, {
        shouldIgnore: () => Date.now() < ignoreBackdropCloseUntilReference.current,
    });
    useDialogFocusTrap({ containerReference: modalReference });

    return (
        <div
            {...backdropDismissal}
            style={{
                background: 'rgba(0, 0, 0, 0.45)',
                display: 'grid',
                inset: 0,
                placeItems: 'center',
                position: 'fixed',
                zIndex: 3500,
            }}
        >
            <div
                aria-label="Settings"
                aria-modal="true"
                onClick={(event) => event.stopPropagation()}
                ref={modalReference}
                role="dialog"
                style={{
                    background: t.bg.popup,
                    border: `1px solid ${t.border.normal}`,
                    borderRadius: t.radius.lg,
                    boxShadow: t.shadow.popupStrong,
                    color: t.text.primary,
                    display: 'grid',
                    gridTemplateColumns: `${sidebarWidth}px 1fr`,
                    height: `${modalHeight}px`,
                    left: `calc(50% + ${dragOffset.x}px)`,
                    maxHeight: '90vh',
                    maxWidth: '92vw',
                    overflow: 'hidden',
                    position: 'fixed',
                    top: `calc(50% + ${dragOffset.y}px)`,
                    transform: 'translate(-50%, -50%)',
                    width: `${modalWidth}px`,
                }}
                tabIndex={-1}
            >
                {children({ beginDrag, modalHeight, modalWidth, sidebarWidth })}
                <div
                    data-settings-resize-zone="true"
                    onMouseDown={beginResize}
                    style={{
                        bottom: 0,
                        cursor: 'ns-resize',
                        height: `${8 * uiScale}px`,
                        left: 0,
                        position: 'absolute',
                        right: `${16 * uiScale}px`,
                    }}
                />
                <div
                    data-settings-resize-zone="true"
                    onMouseDown={beginResize}
                    style={{
                        bottom: `${16 * uiScale}px`,
                        cursor: 'ew-resize',
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        width: `${8 * uiScale}px`,
                    }}
                />
                <div
                    data-settings-resize-zone="true"
                    onMouseDown={beginResize}
                    style={{
                        bottom: 0,
                        cursor: 'nwse-resize',
                        height: `${16 * uiScale}px`,
                        position: 'absolute',
                        right: 0,
                        width: `${16 * uiScale}px`,
                    }}
                />
            </div>
        </div>
    );
}

function clampDragOffset(x: number, y: number, modalWidth: number, modalHeight: number): { x: number; y: number } {
    const maxX = Math.max(0, (globalThis.innerWidth - modalWidth) / 2);
    const maxY = Math.max(0, (globalThis.innerHeight - modalHeight) / 2);

    return {
        x: clamp(x, -maxX, maxX),
        y: clamp(y, -maxY, maxY),
    };
}

function clampModalSize(width: number, height: number, uiScale: number): { height: number; width: number } {
    const maxWidth = globalThis.innerWidth * 0.96;
    const maxHeight = globalThis.innerHeight * 0.95;
    const minWidth = Math.min(620 * uiScale, maxWidth);
    const minHeight = Math.min(420 * uiScale, maxHeight);

    return {
        height: clamp(height, minHeight, maxHeight),
        width: clamp(width, minWidth, maxWidth),
    };
}

