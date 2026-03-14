import {
    type MouseEvent as ReactMouseEvent,
    type ReactNode,
    useEffect,
    useState,
} from 'react';

import { editorTheme as t } from '../../theme/editorTheme';

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
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const modalWidth = Math.min(980 * uiScale, globalThis.innerWidth * 0.92);
    const modalHeight = Math.min(560 * uiScale, globalThis.innerHeight * 0.9);
    const sidebarWidth = Math.min(260 * uiScale, Math.max(180, modalWidth * 0.38));

    useEffect(() => {
        globalThis.setTimeout(() => {
            setDragOffset({ x: 0, y: 0 });
        }, 0);
    }, [uiScale]);

    useEffect(() => {
        const onResize = () => {
            setDragOffset((current) => clampDragOffset(current.x, current.y, modalWidth, modalHeight));
        };

        globalThis.addEventListener('resize', onResize);
        return () => globalThis.removeEventListener('resize', onResize);
    }, [modalHeight, modalWidth]);

    const beginDrag = (event: ReactMouseEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        if ((event.target as HTMLElement).closest('[data-settings-close="true"]')) return;

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

    return (
        <div
            onClick={onBackdropClick}
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
                onClick={(event) => event.stopPropagation()}
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
            >
                {children({ beginDrag, modalHeight, modalWidth, sidebarWidth })}
            </div>
        </div>
    );
}

function clamp(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function clampDragOffset(x: number, y: number, modalWidth: number, modalHeight: number): { x: number; y: number } {
    const maxX = Math.max(0, (globalThis.innerWidth - modalWidth) / 2);
    const maxY = Math.max(0, (globalThis.innerHeight - modalHeight) / 2);

    return {
        x: clamp(x, -maxX, maxX),
        y: clamp(y, -maxY, maxY),
    };
}

