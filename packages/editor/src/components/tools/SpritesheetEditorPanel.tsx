import { convertFileSrc } from '@tauri-apps/api/core';
import { type CSSProperties, type MouseEvent, useMemo, useState } from 'react';

import { useProjectStore } from '../../store/storeBootstrap';
import { useEditorStore } from '../../store/useEditorStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { getExtension, IMG_EXT } from '../../utils/assetTypes';

type FrameCell = {
    column: number;
    frameHeight: number;
    frameWidth: number;
    index: number;
    row: number;
    x: number;
    y: number;
};

type GridMode = 'frameCount' | 'frameSize';

export function SpritesheetEditorPanel() {
    const projectPath = useProjectStore((state) => state.projectPath);
    const selectedAssetPath = useEditorStore((state) => state.selectedAssetPath);
    const uiScale = useSettingsStore((state) => state.uiScale);

    const [zoom, setZoom] = useState(1);
    const [mode, setMode] = useState<GridMode>('frameSize');
    const [frameWidthInput, setFrameWidthInput] = useState(64);
    const [frameHeightInput, setFrameHeightInput] = useState(64);
    const [columnsInput, setColumnsInput] = useState(4);
    const [rowsInput, setRowsInput] = useState(4);
    const [naturalSize, setNaturalSize] = useState<{ height: number; width: number; }>({ height: 0, width: 0 });
    const [hoveredFrame, setHoveredFrame] = useState<FrameCell>();
    const [selectedFrame, setSelectedFrame] = useState<FrameCell>();

    const extension = getExtension(selectedAssetPath ?? '');
    const isSupportedAsset = Boolean(selectedAssetPath) && IMG_EXT.has(extension);

    const imageSource = useMemo(() => {
        if (!selectedAssetPath) return;
        if (selectedAssetPath.startsWith('http')) return selectedAssetPath;
        if (!projectPath) return selectedAssetPath;
        return convertFileSrc(projectPath + selectedAssetPath);
    }, [projectPath, selectedAssetPath]);

    const frameWidth = mode === 'frameCount'
        ? Math.max(1, Math.floor(naturalSize.width / Math.max(1, columnsInput)))
        : Math.max(1, frameWidthInput);
    const frameHeight = mode === 'frameCount'
        ? Math.max(1, Math.floor(naturalSize.height / Math.max(1, rowsInput)))
        : Math.max(1, frameHeightInput);

    const columns = Math.max(1, Math.floor(naturalSize.width / frameWidth));
    const rows = Math.max(1, Math.floor(naturalSize.height / frameHeight));
    const frameCount = columns * rows;

    const scaledWidth = naturalSize.width * zoom;
    const scaledHeight = naturalSize.height * zoom;
    const scaledFrameWidth = frameWidth * zoom;
    const scaledFrameHeight = frameHeight * zoom;
    const gridStepX = Math.max(1, scaledFrameWidth);
    const gridStepY = Math.max(1, scaledFrameHeight);

    const toFrameCell = (offsetX: number, offsetY: number): FrameCell | undefined => {
        if (!naturalSize.width || !naturalSize.height) return undefined;
        if (!scaledFrameWidth || !scaledFrameHeight) return undefined;

        const clampedX = Math.max(0, Math.min(offsetX, scaledWidth - 1));
        const clampedY = Math.max(0, Math.min(offsetY, scaledHeight - 1));

        const column = Math.min(columns - 1, Math.floor(clampedX / scaledFrameWidth));
        const row = Math.min(rows - 1, Math.floor(clampedY / scaledFrameHeight));
        const index = row * columns + column;

        return {
            column,
            frameHeight,
            frameWidth,
            index,
            row,
            x: column * frameWidth,
            y: row * frameHeight,
        };
    };

    const resolveFrameFromMouseEvent = (event: MouseEvent<HTMLDivElement>) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        return toFrameCell(event.clientX - bounds.left, event.clientY - bounds.top);
    };

    const containerStyle: CSSProperties = {
        background: t.bg.panelAlt,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.md,
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        padding: `${8 * uiScale}px`,
        position: 'relative',
    };

    return (
        <div
            className="zerith-scrollbar"
            style={{
                color: t.text.normal,
                display: 'flex',
                flexDirection: 'column',
                fontSize: `${11 * uiScale}px`,
                gap: `${8 * uiScale}px`,
                height: '100%',
                padding: `${8 * uiScale}px`,
            }}
        >
            <div style={{ alignItems: 'center', display: 'flex', gap: `${8 * uiScale}px` }}>
                <strong style={{ color: t.text.primary, flex: 1 }}>Spritesheet Editor</strong>
                <label style={{ alignItems: 'center', display: 'flex', gap: `${6 * uiScale}px` }}>
                    Zoom
                    <input
                        max={8}
                        min={0.25}
                        onChange={(event) => setZoom(Number(event.target.value))}
                        step={0.25}
                        type="range"
                        value={zoom}
                    />
                    <span style={{ color: t.text.muted, minWidth: `${46 * uiScale}px` }}>{(zoom * 100).toFixed(0)}%</span>
                </label>
            </div>

            <div style={{ color: t.text.muted, display: 'grid', gap: `${6 * uiScale}px`, gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
                <label style={{ alignItems: 'center', display: 'flex', gap: `${6 * uiScale}px` }}>
                    <span>Mode</span>
                    <select
                        onChange={(event) => setMode(event.target.value as GridMode)}
                        style={{ background: t.bg.input, border: `1px solid ${t.border.input}`, borderRadius: t.radius.sm, color: t.text.primary, minWidth: `${118 * uiScale}px` }}
                        value={mode}
                    >
                        <option value="frameSize">Frame size</option>
                        <option value="frameCount">Rows x columns</option>
                    </select>
                </label>

                {mode === 'frameSize' ? (
                    <>
                        <NumberInput label="Frame W" min={1} onChange={setFrameWidthInput} uiScale={uiScale} value={frameWidthInput} />
                        <NumberInput label="Frame H" min={1} onChange={setFrameHeightInput} uiScale={uiScale} value={frameHeightInput} />
                    </>
                ) : (
                    <>
                        <NumberInput label="Columns" min={1} onChange={setColumnsInput} uiScale={uiScale} value={columnsInput} />
                        <NumberInput label="Rows" min={1} onChange={setRowsInput} uiScale={uiScale} value={rowsInput} />
                    </>
                )}

                <div style={{ color: t.text.faint, display: 'flex', flexDirection: 'column', gridColumn: 'span 2', justifyContent: 'center' }}>
                    <span>Frames: {frameCount}</span>
                    <span>Hover: {hoveredFrame ? hoveredFrame.index : '-'}</span>
                </div>
            </div>

            {!selectedAssetPath && <div style={containerStyle}>Select an image from Explorer to inspect a spritesheet.</div>}

            {!!selectedAssetPath && !isSupportedAsset && (
                <div style={containerStyle}>
                    <div style={{ color: t.text.faint }}>Unsupported file type for spritesheets: <code>{extension || '(none)'}</code></div>
                    <div style={{ color: t.text.faint, marginTop: `${6 * uiScale}px` }}>Supported: .avif, .png, .jpg, .webp</div>
                </div>
            )}

            {!!selectedAssetPath && isSupportedAsset && !!imageSource && (
                <div style={{ display: 'grid', flex: 1, gap: `${8 * uiScale}px`, gridTemplateColumns: 'minmax(0, 1fr) 220px', minHeight: 0 }}>
                    <div className="zerith-scrollbar" style={containerStyle}>
                        <div style={{ minHeight: '100%', minWidth: '100%', position: 'relative' }}>
                            <div
                                onClick={(event) => {
                                    const frame = resolveFrameFromMouseEvent(event);
                                    if (frame) setSelectedFrame(frame);
                                }}
                                onMouseLeave={() => setHoveredFrame(undefined)}
                                onMouseMove={(event) => {
                                    const frame = resolveFrameFromMouseEvent(event);
                                    setHoveredFrame(frame);
                                }}
                                style={{
                                    display: 'inline-block',
                                    height: `${scaledHeight}px`,
                                    position: 'relative',
                                    width: `${scaledWidth}px`,
                                }}
                            >
                                <img
                                    alt={selectedAssetPath}
                                    onLoad={(event) => {
                                        setNaturalSize({
                                            height: event.currentTarget.naturalHeight,
                                            width: event.currentTarget.naturalWidth,
                                        });
                                        setHoveredFrame(undefined);
                                        setSelectedFrame(undefined);
                                    }}
                                    src={imageSource}
                                    style={{
                                        display: 'block',
                                        height: `${scaledHeight}px`,
                                        imageRendering: 'pixelated',
                                        userSelect: 'none',
                                        width: `${scaledWidth}px`,
                                    }}
                                />

                                {/* Overlay a fixed-size grid to preview frame boundaries. */}
                                <div
                                    style={{
                                        backgroundImage: [
                                            `repeating-linear-gradient(to right, transparent 0px, transparent ${gridStepX - 1}px, rgba(255,255,255,0.4) ${gridStepX - 1}px, rgba(255,255,255,0.4) ${gridStepX}px)`,
                                            `repeating-linear-gradient(to bottom, transparent 0px, transparent ${gridStepY - 1}px, rgba(255,255,255,0.4) ${gridStepY - 1}px, rgba(255,255,255,0.4) ${gridStepY}px)`,
                                        ].join(','),
                                        inset: 0,
                                        pointerEvents: 'none',
                                        position: 'absolute',
                                    }}
                                />

                                <FrameHighlight cell={hoveredFrame} color="rgba(147,197,253,0.32)" zoom={zoom} />
                                <FrameHighlight cell={selectedFrame} color="rgba(253,224,71,0.32)" zoom={zoom} />
                            </div>
                        </div>
                    </div>

                    <div style={{
                        background: t.bg.panelAlt,
                        border: `1px solid ${t.border.subtle}`,
                        borderRadius: t.radius.md,
                        color: t.text.muted,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: `${6 * uiScale}px`,
                        padding: `${8 * uiScale}px`,
                    }}>
                        <strong style={{ color: t.text.primary }}>Frame Details</strong>
                        <FrameDetails cell={selectedFrame} uiScale={uiScale} />
                    </div>
                </div>
            )}
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value: number; }) {
    return (
        <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
            <span>{label}</span>
            <code>{value}</code>
        </div>
    );
}

function FrameDetails({ cell, uiScale }: { cell: FrameCell | undefined; uiScale: number; }) {
    if (!cell) {
        return <div style={{ color: t.text.faint, fontStyle: 'italic', marginTop: `${4 * uiScale}px` }}>Click a frame to inspect coordinates.</div>;
    }

    return (
        <>
            <DetailRow label="Index" value={cell.index} />
            <DetailRow label="Row" value={cell.row} />
            <DetailRow label="Column" value={cell.column} />
            <DetailRow label="X" value={cell.x} />
            <DetailRow label="Y" value={cell.y} />
            <DetailRow label="Width" value={cell.frameWidth} />
            <DetailRow label="Height" value={cell.frameHeight} />
        </>
    );
}

function FrameHighlight({ cell, color, zoom }: { cell: FrameCell | undefined; color: string; zoom: number; }) {
    if (!cell) return;

    return (
        <div
            style={{
                background: color,
                border: '1px solid rgba(255,255,255,0.75)',
                boxSizing: 'border-box',
                height: `${cell.frameHeight * zoom}px`,
                left: `${cell.x * zoom}px`,
                pointerEvents: 'none',
                position: 'absolute',
                top: `${cell.y * zoom}px`,
                width: `${cell.frameWidth * zoom}px`,
            }}
        />
    );
}

function NumberInput({ label, min, onChange, uiScale, value }: { label: string; min: number; onChange: (value: number) => void; uiScale: number; value: number; }) {
    return (
        <label style={{ alignItems: 'center', display: 'flex', gap: `${6 * uiScale}px` }}>
            <span>{label}</span>
            <input
                min={min}
                onChange={(event) => {
                    const parsed = Number(event.target.value);
                    if (!Number.isFinite(parsed)) {
                        onChange(min);
                        return;
                    }
                    onChange(Math.max(min, Math.floor(parsed)));
                }}
                style={{ background: t.bg.input, border: `1px solid ${t.border.input}`, borderRadius: t.radius.sm, color: t.text.primary, width: `${82 * uiScale}px` }}
                type="number"
                value={value}
            />
        </label>
    );
}

