import { useMemo, useRef, useState } from 'react';

import { editorTheme as t } from '../../../theme/editorTheme';
import { clamp } from '../../../utils/math';

export type TimelineMinimapRow = {
    color: string;
    hasBreakpoint: boolean;
    index: number;
    isActiveExecution: boolean;
    pathKey: string;
    typeLabel: string;
};

type Properties = {
    onSeek: (ratio: number) => void;
    rows: TimelineMinimapRow[];
    uiScale: number;
    viewportHeightRatio: number;
    viewportStartRatio: number;
};

export function TimelineMinimap({
    onSeek,
    rows,
    uiScale,
    viewportHeightRatio,
    viewportStartRatio,
}: Properties) {
    const isDraggingReference = useRef(false);
    const resizeStartReference = useRef<{ startWidthUnits: number; x: number } | undefined>(undefined);
    const trackReference = useRef<HTMLDivElement | null>(null);
    const viewportPointerOffsetRatioReference = useRef(0);
    const [widthUnits, setWidthUnits] = useState(84);

    const safeViewportHeightRatio = clamp(viewportHeightRatio, 0.04, 1);
    const safeViewportStartRatio = clamp(viewportStartRatio, 0, 1);
    const viewportTravelRatio = 1 - safeViewportHeightRatio;
    const viewportTopRatio = viewportTravelRatio * safeViewportStartRatio;
    const compactLegend = widthUnits < 112;
    const widthPx = widthUnits * uiScale;

    const markers = useMemo(() => {
        const total = Math.max(1, rows.length);
        const rowHeightPercent = Math.max(100 / total, 0.45);

        return rows.map((row) => ({
            ...row,
            heightPercent: rowHeightPercent,
            topPercent: (row.index / total) * 100,
        }));
    }, [rows]);

    const seekFromClientY = (clientY: number, forceCenter = false) => {
        const bounds = trackReference.current?.getBoundingClientRect();
        if (!bounds) return;

        const y = clamp(clientY - bounds.top, 0, bounds.height);
        const pointerRatio = bounds.height <= 0 ? 0 : y / bounds.height;

        const offsetRatio = forceCenter
            ? safeViewportHeightRatio / 2
            : viewportPointerOffsetRatioReference.current;

        const nextViewportTopRatio = clamp(pointerRatio - offsetRatio, 0, viewportTravelRatio);
        const nextSeekRatio = viewportTravelRatio <= 0 ? 0 : nextViewportTopRatio / viewportTravelRatio;
        onSeek(nextSeekRatio);
    };

    return (
        <div
            style={{
                alignItems: 'stretch',
                background: t.bg.panel,
                border: `1px solid ${t.border.subtle}`,
                borderRadius: t.radius.sm,
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                gap: `${5 * uiScale}px`,
                overflow: 'hidden',
                padding: `${4 * uiScale}px`,
                position: 'relative',
                width: `${widthPx}px`,
            }}
            title="Minimap: strip color = command type, green = active execution, red dot = breakpoint, outline = visible viewport. Click or drag to scroll."
        >
            <div
                onPointerCancel={() => {
                    isDraggingReference.current = false;
                }}
                onPointerDown={(event) => {
                    event.preventDefault();
                    isDraggingReference.current = true;
                    event.currentTarget.setPointerCapture(event.pointerId);

                    const bounds = event.currentTarget.getBoundingClientRect();
                    const pointerRatio = bounds.height <= 0 ? 0 : clamp((event.clientY - bounds.top) / bounds.height, 0, 1);
                    const viewportBottomRatio = viewportTopRatio + safeViewportHeightRatio;
                    const pointerInViewport = pointerRatio >= viewportTopRatio && pointerRatio <= viewportBottomRatio;

                    viewportPointerOffsetRatioReference.current = pointerInViewport
                        ? pointerRatio - viewportTopRatio
                        : safeViewportHeightRatio / 2;

                    seekFromClientY(event.clientY, !pointerInViewport);
                }}
                onPointerMove={(event) => {
                    if (!isDraggingReference.current) return;
                    seekFromClientY(event.clientY);
                }}
                onPointerUp={(event) => {
                    if (!isDraggingReference.current) return;
                    isDraggingReference.current = false;
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                    seekFromClientY(event.clientY);
                }}
                ref={trackReference}
                style={{
                    background: t.bg.app,
                    border: `1px solid ${t.border.subtle}`,
                    borderRadius: `${2 * uiScale}px`,
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                    position: 'relative',
                }}
                title="Timeline minimap"
            >
                {rows.length === 0 ? (
                    <div
                        style={{
                            alignItems: 'center',
                            color: t.text.faint,
                            display: 'flex',
                            fontSize: `${10 * uiScale}px`,
                            height: '100%',
                            justifyContent: 'center',
                            padding: `${4 * uiScale}px`,
                            textAlign: 'center',
                        }}
                    >
                        No commands
                    </div>
                ) : undefined}

                {markers.map((marker) => (
                    <div
                        key={marker.pathKey}
                        style={{
                            background: marker.isActiveExecution ? t.accent.green : marker.color,
                            borderLeft: marker.isActiveExecution ? `2px solid ${t.text.primary}` : undefined,
                            boxShadow: marker.hasBreakpoint ? `inset -${2 * uiScale}px 0 0 ${t.accent.red}` : undefined,
                            height: `${marker.heightPercent}%`,
                            left: 0,
                            minHeight: `${1 * uiScale}px`,
                            opacity: marker.isActiveExecution ? 1 : 0.9,
                            position: 'absolute',
                            top: `${marker.topPercent}%`,
                            width: '100%',
                        }}
                        title={`Type: ${marker.typeLabel}${marker.hasBreakpoint ? ' • breakpoint' : ''}${marker.isActiveExecution ? ' • active execution' : ''}`}
                    >
                        {marker.hasBreakpoint && (
                            <span
                                style={{
                                    background: t.accent.red,
                                    borderRadius: '50%',
                                    boxShadow: `0 0 ${3 * uiScale}px rgba(0, 0, 0, 0.45)`,
                                    height: `${4 * uiScale}px`,
                                    position: 'absolute',
                                    right: `${uiScale}px`,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: `${4 * uiScale}px`,
                                }}
                            />
                        )}
                    </div>
                ))}

                <div
                    style={{
                        border: `2px solid ${t.border.accent}`,
                        borderRadius: `${2 * uiScale}px`,
                        boxSizing: 'border-box',
                        height: `${safeViewportHeightRatio * 100}%`,
                        left: 0,
                        pointerEvents: 'none',
                        position: 'absolute',
                        top: `${viewportTopRatio * 100}%`,
                        width: '100%',
                    }}
                />
            </div>

            <div style={{ color: t.text.muted, display: 'grid', fontSize: `${10 * uiScale}px`, gap: `${3 * uiScale}px` }}>
                <LegendRow color="linear-gradient(90deg, #14b8a6, #eab308)" compact={compactLegend} label="Type color" uiScale={uiScale} />
                <LegendRow color={t.accent.green} compact={compactLegend} label="Active" uiScale={uiScale} />
                <LegendRow color={t.accent.red} compact={compactLegend} label="Breakpoint" uiScale={uiScale} />
                <LegendRow color={t.border.accent} compact={compactLegend} label="Viewport" uiScale={uiScale} />
            </div>

            <div
                onPointerCancel={(event) => {
                    resizeStartReference.current = undefined;
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                }}
                onPointerDown={(event) => {
                    event.preventDefault();
                    resizeStartReference.current = { startWidthUnits: widthUnits, x: event.clientX };
                    event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                    const start = resizeStartReference.current;
                    if (!start) return;
                    const deltaUnits = (start.x - event.clientX) / Math.max(0.1, uiScale);
                    setWidthUnits(clamp(start.startWidthUnits + deltaUnits, 36, 180));
                }}
                onPointerUp={(event) => {
                    resizeStartReference.current = undefined;
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                }}
                style={{
                    borderRight: `1px solid ${t.border.subtle}`,
                    bottom: 0,
                    cursor: 'col-resize',
                    left: 0,
                    opacity: 0.85,
                    position: 'absolute',
                    top: 0,
                    width: `${6 * uiScale}px`,
                }}
                title="Drag to resize minimap width"
            />
        </div>
    );
}

function LegendRow({
    color,
    compact,
    label,
    uiScale,
}: {
    color: string;
    compact: boolean;
    label: string;
    uiScale: number;
}) {
    return (
        <div style={{ alignItems: 'center', display: 'flex', gap: `${4 * uiScale}px` }} title={label}>
            <span
                style={{
                    background: color,
                    borderRadius: 2,
                    display: 'inline-block',
                    height: `${6 * uiScale}px`,
                    width: `${10 * uiScale}px`,
                }}
            />
            {!compact && <span>{label}</span>}
        </div>
    );
}


