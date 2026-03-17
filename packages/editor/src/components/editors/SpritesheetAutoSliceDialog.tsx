import { generateGridFrames, type SpritesheetDescriptor } from 'core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { editorTheme as t } from '../../theme/editorTheme';
import { styles } from '../../theme/styleHelpers';
import {
    getFrameSizeFromGridSize,
    getGridSizeFromFrameSize,
    getInitialGridValues,
    getSuggestedGridValues,
} from './spritesheetAutoSliceModel';

type InputMode = 'frameSize' | 'gridSize';

type SpritesheetAutoSliceDialogProperties = {
    image: HTMLImageElement;
    imagePath: string;
    onCancel: () => void;
    onCreate: (descriptor: SpritesheetDescriptor) => void;
    uiScale: number;
};

export function SpritesheetAutoSliceDialog({
    image,
    imagePath,
    onCancel,
    onCreate,
    uiScale,
}: SpritesheetAutoSliceDialogProperties) {
    const canvasReference = useRef<HTMLCanvasElement>(null);
    const [inputMode, setInputMode] = useState<InputMode>('frameSize');
    const initialGrid = useMemo(
        () => getInitialGridValues(image.naturalWidth, image.naturalHeight),
        [image.naturalHeight, image.naturalWidth],
    );

    const [frameWidth, setFrameWidth] = useState(initialGrid.frameWidth);
    const [frameHeight, setFrameHeight] = useState(initialGrid.frameHeight);
    const [columns, setColumns] = useState(initialGrid.columns);
    const [rows, setRows] = useState(initialGrid.rows);

    const [useChromaKey, setUseChromaKey] = useState(false);
    const [chromaKey, setChromaKey] = useState('#00b140');
    const [chromaTolerance, setChromaTolerance] = useState(30);

    const frames = useMemo(() => (
        generateGridFrames(image.naturalWidth, image.naturalHeight, frameWidth, frameHeight)
    ), [frameHeight, frameWidth, image.naturalHeight, image.naturalWidth]);

    const handleCreate = useCallback(() => {
        const descriptor: SpritesheetDescriptor = {
            format: 'atlas',
            frames,
            source: basename(imagePath),
        };

        if (useChromaKey) {
            descriptor.chromaKey = chromaKey;
            descriptor.chromaTolerance = chromaTolerance;
        }

        onCreate(descriptor);
    }, [chromaKey, chromaTolerance, frames, imagePath, onCreate, useChromaKey]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onCancel();
            }
            if (event.key === 'Enter') {
                handleCreate();
            }
        };

        globalThis.addEventListener('keydown', onKey);
        return () => globalThis.removeEventListener('keydown', onKey);
    }, [handleCreate, onCancel]);

    useEffect(() => {
        const canvas = canvasReference.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const maxPreviewWidth = 900 * uiScale;
        const maxPreviewHeight = 480 * uiScale;
        const scale = Math.min(
            maxPreviewWidth / image.naturalWidth,
            maxPreviewHeight / image.naturalHeight,
            1,
        );
        const width = Math.max(1, Math.floor(image.naturalWidth * scale));
        const height = Math.max(1, Math.floor(image.naturalHeight * scale));
        const dpr = globalThis.window?.devicePixelRatio ?? 1;

        canvas.width = Math.max(1, Math.floor(width * dpr));
        canvas.height = Math.max(1, Math.floor(height * dpr));
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.scale(dpr, dpr);
        context.imageSmoothingEnabled = false;
        context.drawImage(image, 0, 0, width, height);

        context.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        context.lineWidth = 1;

        const scaledFrameWidth = Math.max(1, frameWidth * scale);
        const scaledFrameHeight = Math.max(1, frameHeight * scale);

        for (let x = scaledFrameWidth; x < width; x += scaledFrameWidth) {
            context.beginPath();
            context.moveTo(Math.floor(x) + 0.5, 0);
            context.lineTo(Math.floor(x) + 0.5, height);
            context.stroke();
        }

        for (let y = scaledFrameHeight; y < height; y += scaledFrameHeight) {
            context.beginPath();
            context.moveTo(0, Math.floor(y) + 0.5);
            context.lineTo(width, Math.floor(y) + 0.5);
            context.stroke();
        }
    }, [frameHeight, frameWidth, image, uiScale]);

    const detectGrid = () => {
        const suggestion = getSuggestedGridValues(image.naturalWidth, image.naturalHeight);
        if (!suggestion) {
            return;
        }

        setFrameWidth(suggestion.frameWidth);
        setFrameHeight(suggestion.frameHeight);
        setColumns(suggestion.columns);
        setRows(suggestion.rows);
        setInputMode('frameSize');
    };

    const handleFrameDimensionChange = (nextWidth: number, nextHeight: number) => {
        const nextValues = getGridSizeFromFrameSize(image.naturalWidth, image.naturalHeight, nextWidth, nextHeight);
        setFrameWidth(nextValues.frameWidth);
        setFrameHeight(nextValues.frameHeight);
        setColumns(nextValues.columns);
        setRows(nextValues.rows);
    };

    const handleGridDimensionChange = (nextColumns: number, nextRows: number) => {
        const nextValues = getFrameSizeFromGridSize(image.naturalWidth, image.naturalHeight, nextColumns, nextRows);
        setColumns(nextValues.columns);
        setRows(nextValues.rows);
        setFrameWidth(nextValues.frameWidth);
        setFrameHeight(nextValues.frameHeight);
    };

    return (
        <div onClick={onCancel} style={{ background: 'rgba(0,0,0,.45)', display: 'grid', inset: 0, placeItems: 'center', position: 'fixed', zIndex: 2100 }}>
            <div
                onClick={(event) => event.stopPropagation()}
                style={{
                    background: t.bg.panel,
                    border: `1px solid ${t.border.normal}`,
                    borderRadius: t.radius.lg,
                    boxShadow: t.shadow.popupStrong,
                    color: t.text.primary,
                    display: 'grid',
                    gap: `${12 * uiScale}px`,
                    gridTemplateRows: 'auto auto 1fr auto',
                    maxHeight: '85vh',
                    maxWidth: `${1040 * uiScale}px`,
                    minHeight: `${420 * uiScale}px`,
                    padding: `${16 * uiScale}px`,
                    width: '92vw',
                }}
            >
                <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontSize: `${14 * uiScale}px`, fontWeight: 700 }}>Auto-slice spritesheet</div>
                        <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>{basename(imagePath)}</div>
                    </div>
                    <button onClick={detectGrid} style={{ ...styles.buttonBase(uiScale) }}>Detect Grid</button>
                </div>

                <div style={{ display: 'grid', gap: `${8 * uiScale}px`, gridTemplateColumns: '1fr 1fr 1fr' }}>
                    <label style={{ alignItems: 'center', color: t.text.normal, display: 'flex', gap: `${6 * uiScale}px` }}>
                        <input checked={inputMode === 'frameSize'} onChange={() => setInputMode('frameSize')} type="radio" />
                        Frame size
                    </label>
                    <label style={{ alignItems: 'center', color: t.text.normal, display: 'flex', gap: `${6 * uiScale}px` }}>
                        <input checked={inputMode === 'gridSize'} onChange={() => setInputMode('gridSize')} type="radio" />
                        Columns x Rows
                    </label>
                    <label style={{ alignItems: 'center', color: t.text.normal, display: 'flex', gap: `${6 * uiScale}px` }}>
                        <input checked={useChromaKey} onChange={(event) => setUseChromaKey(event.target.checked)} type="checkbox" />
                        Enable chroma key
                    </label>
                </div>

                <div style={{ display: 'grid', gap: `${12 * uiScale}px`, gridTemplateColumns: `${260 * uiScale}px minmax(0, 1fr)` }}>
                    <div className="zerith-scrollbar" style={{ display: 'grid', gap: `${10 * uiScale}px`, overflowY: 'auto', paddingRight: `${4 * uiScale}px` }}>
                        {inputMode === 'frameSize' ? (
                            <>
                                <label style={{ color: t.text.muted, display: 'grid', gap: `${4 * uiScale}px` }}>
                                    Frame Width
                                    <input
                                        min={1}
                                        onChange={(event) => handleFrameDimensionChange(Number(event.target.value), frameHeight)}
                                        style={styles.input(uiScale)}
                                        type="number"
                                        value={frameWidth}
                                    />
                                </label>
                                <label style={{ color: t.text.muted, display: 'grid', gap: `${4 * uiScale}px` }}>
                                    Frame Height
                                    <input
                                        min={1}
                                        onChange={(event) => handleFrameDimensionChange(frameWidth, Number(event.target.value))}
                                        style={styles.input(uiScale)}
                                        type="number"
                                        value={frameHeight}
                                    />
                                </label>
                            </>
                        ) : (
                            <>
                                <label style={{ color: t.text.muted, display: 'grid', gap: `${4 * uiScale}px` }}>
                                    Columns
                                    <input
                                        min={1}
                                        onChange={(event) => handleGridDimensionChange(Number(event.target.value), rows)}
                                        style={styles.input(uiScale)}
                                        type="number"
                                        value={columns}
                                    />
                                </label>
                                <label style={{ color: t.text.muted, display: 'grid', gap: `${4 * uiScale}px` }}>
                                    Rows
                                    <input
                                        min={1}
                                        onChange={(event) => handleGridDimensionChange(columns, Number(event.target.value))}
                                        style={styles.input(uiScale)}
                                        type="number"
                                        value={rows}
                                    />
                                </label>
                            </>
                        )}

                        <label style={{ color: t.text.muted, display: 'grid', gap: `${4 * uiScale}px` }}>
                            Chroma color
                            <input
                                disabled={!useChromaKey}
                                onChange={(event) => setChromaKey(event.target.value)}
                                style={{ ...styles.input(uiScale), height: `${36 * uiScale}px`, padding: `${4 * uiScale}px` }}
                                type="color"
                                value={chromaKey}
                            />
                        </label>

                        <label style={{ color: t.text.muted, display: 'grid', gap: `${4 * uiScale}px` }}>
                            Tolerance ({chromaTolerance})
                            <input
                                disabled={!useChromaKey}
                                max={100}
                                min={10}
                                onChange={(event) => setChromaTolerance(clamp(event.target.valueAsNumber, 10, 100))}
                                type="range"
                                value={chromaTolerance}
                            />
                        </label>

                        <div style={{ color: t.text.faint, fontSize: `${12 * uiScale}px` }}>
                            {Object.keys(frames).length} frame(s) • {frameWidth}x{frameHeight}
                        </div>
                    </div>

                    <div style={{ alignItems: 'center', background: t.bg.panelAlt, border: `1px solid ${t.border.subtle}`, borderRadius: t.radius.md, display: 'grid', minHeight: 0, overflow: 'auto', padding: `${10 * uiScale}px`, placeItems: 'center' }}>
                        <canvas ref={canvasReference} />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: `${8 * uiScale}px`, justifyContent: 'flex-end' }}>
                    <button onClick={onCancel} style={{ ...styles.buttonBase(uiScale) }}>Cancel</button>
                    <button onClick={handleCreate} style={{ ...styles.buttonBase(uiScale), background: t.accent.primary, border: 'none', color: '#fff' }}>Create</button>
                </div>
            </div>
        </div>
    );
}

function basename(path: string): string {
    return path.split(/[\\/]/).pop() ?? path;
}

function clamp(value: number, minimum: number, maximum: number): number {
    if (!Number.isFinite(value)) return minimum;
    return Math.min(maximum, Math.max(minimum, value));
}


