import { Check, Columns3, Copy, Grid3x3, type LucideIcon, MousePointer2, Pipette, RotateCcw, Rows3, Save, Scissors, SquareDashedMousePointer, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { generateGridFrames, parseSpritesheetDescriptor, type SpritesheetDescriptor } from 'zerith-core';

import type { WorkbenchTab } from '../../store/workbench/types';

import { fsDirname, fsJoin, fsWriteTextFile } from '../../services/fs';
import { releaseEditorAssetUrl, resolveEditorAssetUrl } from '../../services/runtime/assetUrls';
import { useProjectStore } from '../../store/storeBootstrap';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { ConfirmDialog } from '../ConfirmDialog';
import { SpritesheetAnimationEditor } from './SpritesheetAnimationEditor';
import { spritesheetButtonStyle } from './spritesheetButtonStyles';
import { SpritesheetCanvas } from './SpritesheetCanvas';
import {
    addSliceLine,
    applyManualFrame,
    applySliceLineFrames,
    buildFramesFromSliceLines,
    duplicateFrame,
    type ManualFrameRect,
    type ManualSliceAxis,
    type ManualSliceLines,
    type ManualTool,
    mergeFrameRectUpdate,
    mergeFrameUpdates,
    moveSliceLine,
} from './spritesheetEditorModel';
import { SpritesheetFrameList } from './SpritesheetFrameList';


type SpritesheetEditorPanelProperties = {
    tab: WorkbenchTab;
};

type ToolButtonProperties = {
    active?: boolean;
    disabled?: boolean;
    icon: LucideIcon;
    label: string;
    onClick: () => void;
    primary?: boolean;
    title?: string;
    uiScale: number;
};

export function SpritesheetEditorPanel({ tab }: SpritesheetEditorPanelProperties) {
    const clearFileDirty = useProjectStore((state) => state.clearFileDirty);
    const uiScale = useSettingsStore((state) => state.uiScale);
    const updateTabContent = useWorkbenchStore((state) => state.updateTabContent);

    const [descriptor, setDescriptor] = useState<SpritesheetDescriptor>();
    const [descriptorRoot, setDescriptorRoot] = useState<Record<string, unknown>>({});
    const [descriptorError, setDescriptorError] = useState<string>();
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string>();

    const [selectedFrameName, setSelectedFrameName] = useState<string>();
    const [zoomLevel, setZoomLevel] = useState(1);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [showGrid, setShowGrid] = useState(true);
    const [showChromaPreview, setShowChromaPreview] = useState(false);
    const [manualTool, setManualTool] = useState<ManualTool>('select');
    const [sliceAxis, setSliceAxis] = useState<ManualSliceAxis>('vertical');
    const [sliceLines, setSliceLines] = useState<ManualSliceLines>({ horizontal: [], vertical: [] });
    const [manualRectPreview, setManualRectPreview] = useState<ManualFrameRect>();
    const [frameDialogMessage, setFrameDialogMessage] = useState<string>();

    const [imagePath, setImagePath] = useState<string>();
    const [imageUrl, setImageUrl] = useState<string>();
    const [image, setImage] = useState<HTMLImageElement>();
    const [isImageLoading, setIsImageLoading] = useState(false);
    const [imageError, setImageError] = useState<string>();

    const latestSerializedReference = useRef(tab.textContent ?? '{}');
    const frames = useMemo(() => {
        if (!descriptor) return {};
        if (descriptor.format !== 'grid') {
            return descriptor.frames ?? {};
        }

        if (!image || descriptor.frameWidth === undefined || descriptor.frameHeight === undefined) {
            return descriptor.frames ?? {};
        }

        return generateGridFrames(image.naturalWidth, image.naturalHeight, descriptor.frameWidth, descriptor.frameHeight, {
            margin: descriptor.margin,
            spacing: descriptor.spacing,
        });
    }, [descriptor, image]);
    const frameNames = Object.keys(frames);
    const selectedFrame = selectedFrameName ? frames[selectedFrameName] : undefined;
    const canEditAtlasFrames = descriptor?.format === 'atlas';
    const slicePreviewFrames = useMemo(() => {
        if (!image) return [];
        return buildFramesFromSliceLines(sliceLines, {
            height: image.naturalHeight,
            width: image.naturalWidth,
        });
    }, [image, sliceLines]);

    useEffect(() => {
        const rawText = tab.textContent ?? '{}';
        latestSerializedReference.current = rawText;
        setSaveError(undefined);

        let parsedJson: unknown;
        try {
            parsedJson = JSON.parse(rawText);
        } catch {
            setDescriptor(undefined);
            setDescriptorRoot({});
            setDescriptorError('Descriptor JSON is invalid.');
            return;
        }

        const parsedDescriptor = parseSpritesheetDescriptor(parsedJson);
        if (!parsedDescriptor.success) {
            setDescriptor(undefined);
            setDescriptorRoot(isObjectRecord(parsedJson) ? parsedJson : {});
            setDescriptorError(parsedDescriptor.error);
            return;
        }

        const nextDescriptor = parsedDescriptor.data;
        setDescriptor(nextDescriptor);
        setDescriptorRoot(isObjectRecord(parsedJson) ? parsedJson : {});
        setDescriptorError(undefined);
        setSelectedFrameName((current) => current ?? Object.keys(nextDescriptor.frames ?? {})[0]);
    }, [tab.id, tab.textContent]);

    useEffect(() => {
        if (!descriptor) {
            setImage(undefined);
            setImageError(undefined);
            setImagePath(undefined);
            setImageUrl(undefined);
            return;
        }

        let disposed = false;
        let resolvedImageUrl: string | undefined;
        void (async () => {
            try {
                setImageError(undefined);
                const resolvedPath = await resolveImagePath(tab.path, descriptor.source);
                const nextImageUrl = await resolveEditorAssetUrl(resolvedPath);
                resolvedImageUrl = nextImageUrl;
                if (disposed) {
                    releaseEditorAssetUrl(nextImageUrl);
                    return;
                }
                setImagePath(resolvedPath);
                setImageUrl(nextImageUrl);
            } catch (error) {
                if (disposed) return;
                setImage(undefined);
                setImagePath(undefined);
                setImageUrl(undefined);
                setImageError(error instanceof Error ? error.message : 'Failed to resolve image path.');
            }
        })();

        return () => {
            disposed = true;
            if (resolvedImageUrl) {
                releaseEditorAssetUrl(resolvedImageUrl);
            }
        };
    }, [descriptor, tab.path]);

    useEffect(() => {
        if (!imageUrl) return;
        let disposed = false;
        const element = new Image();
        if (shouldUseAnonymousCrossOrigin(imageUrl)) {
            element.crossOrigin = 'anonymous';
        }
        setIsImageLoading(true);
        setImageError(undefined);
        element.addEventListener('load', () => {
            if (disposed) return;
            setImage(element);
            setIsImageLoading(false);
        });
        element.addEventListener('error', () => {
            if (disposed) return;
            setImage(undefined);
            setIsImageLoading(false);
            setImageError('Failed to load source image.');
        });
        element.src = imageUrl;

        return () => {
            disposed = true;
        };
    }, [imageUrl]);

    useEffect(() => {
        if (!selectedFrameName || frames[selectedFrameName]) return;
        setSelectedFrameName(frameNames[0]);
    }, [frameNames, frames, selectedFrameName]);

    useEffect(() => {
        setSliceLines({ horizontal: [], vertical: [] });
        setManualRectPreview(undefined);
        setManualTool('select');
    }, [tab.id]);

    const applyDescriptorUpdate = (nextDescriptor: SpritesheetDescriptor) => {
        setDescriptor(nextDescriptor);
        const nextRoot = { ...descriptorRoot, ...nextDescriptor };
        setDescriptorRoot(nextRoot);
        const nextText = `${JSON.stringify(nextRoot, undefined, 4)}\n`;
        latestSerializedReference.current = nextText;
        updateTabContent(tab.id, nextText);
    };

    const handleSave = async () => {
        if (!descriptor) return;
        setIsSaving(true);
        setSaveError(undefined);
        try {
            await fsWriteTextFile(tab.path, latestSerializedReference.current);
            updateTabContent(tab.id, latestSerializedReference.current, { markDirty: false });
            clearFileDirty(tab.path);
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'Failed to save descriptor.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddFrame = () => {
        if (!descriptor || descriptor.format !== 'atlas') return;

        const nextName = globalThis.prompt('Frame name', selectedFrameName ? `${selectedFrameName}_copy` : 'frame');
        if (!nextName) return;

        const name = nextName.trim();
        if (!name) {
            setFrameDialogMessage('Frame name is required.');
            return;
        }

        const existingFrames = descriptor.frames ?? {};
        if (existingFrames[name]) {
            setFrameDialogMessage(`Frame "${name}" already exists.`);
            return;
        }

        const rectInput = globalThis.prompt('Frame rect (x,y,w,h)', '0,0,32,32');
        if (!rectInput) return;

        const values = rectInput.split(',').map((value) => Number(value.trim()));
        if (values.length !== 4 || values.some((value) => Number.isNaN(value))) {
            setFrameDialogMessage('Rect must contain four numbers: x,y,w,h');
            return;
        }

        const [x, y, w, h] = values;
        if (x < 0 || y < 0 || w <= 0 || h <= 0) {
            setFrameDialogMessage('x/y must be non-negative and w/h must be positive.');
            return;
        }

        const nextFrames = mergeFrameUpdates(existingFrames, {
            [name]: {
                h,
                w,
                x,
                y,
            },
        });

        applyDescriptorUpdate({ ...descriptor, frames: nextFrames });
        setSelectedFrameName(name);
    };

    const handleCreateManualFrame = (rect?: ManualFrameRect) => {
        if (!descriptor || !rect) return;

        const result = applyManualFrame(descriptor, frames, rect);
        applyDescriptorUpdate(result.descriptor);
        setSelectedFrameName(result.frameName);
        setManualRectPreview(undefined);
    };

    const handleApplySliceLines = () => {
        if (!descriptor || !image) return;

        const result = applySliceLineFrames(descriptor, frames, sliceLines, {
            height: image.naturalHeight,
            width: image.naturalWidth,
        });

        if (result.createdNames.length === 0) {
            return;
        }

        applyDescriptorUpdate(result.descriptor);
        setSelectedFrameName(result.createdNames[0]);
        setSliceLines({ horizontal: [], vertical: [] });
        setManualTool('select');
    };

    const handleRemoveFrame = (name: string) => {
        if (!descriptor || descriptor.format !== 'atlas') return;
        const existingFrames = descriptor.frames ?? {};
        if (!existingFrames[name]) return;

        const nextFrames = mergeFrameUpdates(existingFrames, { [name]: undefined });

        applyDescriptorUpdate({ ...descriptor, frames: nextFrames });
    };

    const handleDuplicateFrame = (name: string) => {
        if (!descriptor) return;
        const result = duplicateFrame(descriptor, frames, name);
        if (!result) return;
        applyDescriptorUpdate(result.descriptor);
        setSelectedFrameName(result.frameName);
    };

    const handleSelectedFrameRectUpdate = (update: Partial<ManualFrameRect>) => {
        if (!descriptor || !image || !selectedFrameName || descriptor.format !== 'atlas') return;
        const nextFrames = mergeFrameRectUpdate(frames, selectedFrameName, update, {
            height: image.naturalHeight,
            width: image.naturalWidth,
        });
        if (nextFrames === frames) return;
        applyDescriptorUpdate({ ...descriptor, frames: nextFrames });
    };

    const handleSelectedFrameNudge = (dx: number, dy: number) => {
        if (!selectedFrame) return;
        handleSelectedFrameRectUpdate({ x: selectedFrame.x + dx, y: selectedFrame.y + dy });
    };

    const resetViewport = () => {
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
    };

    return (
        <div style={{ background: t.bg.app, display: 'grid', gap: 10, gridTemplateRows: 'auto minmax(0, 1fr) auto', height: '100%', padding: 12 }}>
            <div style={{ ...toolbarStyle, gap: `${10 * uiScale}px` }}>
                <div style={{ minWidth: 0 }}>
                    <strong style={{ color: t.text.primary }}>Spritesheet Editor</strong>
                    <div style={{ color: t.text.faint, fontSize: `${12 * uiScale}px`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {descriptor ? `${descriptor.format.toUpperCase()} | ${frameNames.length} frames | ${Object.keys(descriptor.animations ?? {}).length} animations` : 'No descriptor loaded'}
                    </div>
                </div>

                <ToolbarGroup>
                    <ToolButton active={manualTool === 'select'} icon={MousePointer2} label="Select" onClick={() => setManualTool('select')} uiScale={uiScale} />
                    <ToolButton active={manualTool === 'draw'} icon={SquareDashedMousePointer} label="Draw" onClick={() => setManualTool('draw')} uiScale={uiScale} />
                    <ToolButton active={manualTool === 'slice'} icon={Scissors} label="Slice" onClick={() => setManualTool('slice')} uiScale={uiScale} />
                </ToolbarGroup>

                {manualTool === 'slice' ? (
                    <ToolbarGroup>
                        <ToolButton active={sliceAxis === 'vertical'} icon={Columns3} label="Vertical" onClick={() => setSliceAxis('vertical')} uiScale={uiScale} />
                        <ToolButton active={sliceAxis === 'horizontal'} icon={Rows3} label="Horizontal" onClick={() => setSliceAxis('horizontal')} uiScale={uiScale} />
                        <ToolButton disabled={slicePreviewFrames.length === 0} icon={Check} label={`Apply ${slicePreviewFrames.length}`} onClick={handleApplySliceLines} uiScale={uiScale} />
                        <ToolButton
                            icon={Trash2}
                            label="Clear"
                            onClick={() => {
                                setSliceLines({ horizontal: [], vertical: [] });
                                setManualRectPreview(undefined);
                            }}
                            uiScale={uiScale}
                        />
                    </ToolbarGroup>
                ) : undefined}

                {manualTool === 'draw' ? (
                    <ToolbarGroup>
                        <ToolButton disabled={!manualRectPreview} icon={Check} label="Commit" onClick={() => handleCreateManualFrame(manualRectPreview)} uiScale={uiScale} />
                    </ToolbarGroup>
                ) : undefined}

                <ToolbarGroup style={{ marginLeft: 'auto' }}>
                    <ToolButton icon={ZoomOut} label="-" onClick={() => setZoomLevel((value) => Math.max(0.25, value - 0.25))} title="Zoom out" uiScale={uiScale} />
                    <span style={{ color: t.text.muted, minWidth: 48, textAlign: 'center' }}>{Math.round(zoomLevel * 100)}%</span>
                    <ToolButton icon={ZoomIn} label="+" onClick={() => setZoomLevel((value) => Math.min(8, value + 0.25))} title="Zoom in" uiScale={uiScale} />
                    <ToolButton icon={RotateCcw} label="Reset" onClick={resetViewport} title="Reset view" uiScale={uiScale} />
                </ToolbarGroup>

                <ToolbarGroup>
                    <ToggleButton active={showGrid} disabled={descriptor?.format !== 'grid'} icon={Grid3x3} label="Grid" onClick={() => setShowGrid((value) => !value)} uiScale={uiScale} />
                    <ToggleButton active={showChromaPreview} disabled={!descriptor?.chromaKey} icon={Pipette} label="Chroma" onClick={() => setShowChromaPreview((value) => !value)} uiScale={uiScale} />
                    <ToolButton disabled={!descriptor || isSaving} icon={Save} label={isSaving ? 'Saving' : 'Save'} onClick={() => void handleSave()} primary uiScale={uiScale} />
                </ToolbarGroup>
            </div>

            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(180px, 240px) minmax(0, 1fr) minmax(260px, 320px)', minHeight: 0 }}>
                <section className="zerith-scrollbar" style={panelStyle}>
                    {image ? undefined : <div style={{ color: t.text.muted }}>Load source image to preview frames.</div>}
                    {image ? (
                        <SpritesheetFrameList
                            frames={frames}
                            image={image}
                            onAddFrame={descriptor?.format === 'atlas' ? handleAddFrame : undefined}
                            onRemoveFrame={descriptor?.format === 'atlas' ? handleRemoveFrame : undefined}
                            onSelectFrame={setSelectedFrameName}
                            selectedFrame={selectedFrameName}
                            uiScale={uiScale}
                        />
                    ) : undefined}
                </section>

                <section className="zerith-scrollbar" style={{ ...panelStyle, display: 'grid', gap: 8, gridTemplateRows: 'auto minmax(0, 1fr)' }}>
                    {isImageLoading ? <div style={{ color: t.text.muted }}>Loading source image...</div> : undefined}
                    {!isImageLoading && imageError ? <div style={{ color: t.text.muted }}>{imageError}</div> : undefined}
                    {!isImageLoading && !imageError && imagePath ? (
                        <div style={{ alignItems: 'center', color: t.text.muted, display: 'flex', fontSize: `${12 * uiScale}px`, gap: 10, minWidth: 0 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{imagePath}</span>
                            {image ? <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>{image.naturalWidth}x{image.naturalHeight}</span> : undefined}
                        </div>
                    ) : undefined}
                    {!isImageLoading && !imageError && image && imagePath ? (
                        <SpritesheetCanvas
                            chromaKey={showChromaPreview ? descriptor?.chromaKey : undefined}
                            chromaTolerance={descriptor?.chromaTolerance}
                            frames={frames}
                            image={image}
                            manualRectPreview={manualRectPreview}
                            manualTool={manualTool}
                            onSelectFrame={setSelectedFrameName}
                            onSetManualRectPreview={setManualRectPreview}
                            onSliceLineAdd={(axis, value) => {
                                if (!image) return;
                                setSliceLines((current) => addSliceLine(current, axis, value, {
                                    height: image.naturalHeight,
                                    width: image.naturalWidth,
                                }));
                            }}
                            onSliceLineMove={(axis, index, value) => {
                                if (!image) return;
                                setSliceLines((current) => moveSliceLine(current, axis, index, value, {
                                    height: image.naturalHeight,
                                    width: image.naturalWidth,
                                }));
                            }}
                            panOffset={panOffset}
                            selectedFrame={selectedFrameName}
                            setPanOffset={setPanOffset}
                            setZoom={setZoomLevel}
                            showGrid={showGrid && descriptor?.format === 'grid'}
                            sliceAxis={sliceAxis}
                            sliceLines={sliceLines}
                            slicePreviewFrames={slicePreviewFrames}
                            uiScale={uiScale}
                            zoom={zoomLevel}
                        />
                    ) : undefined}
                </section>

                <aside style={{ display: 'grid', gap: 10, gridTemplateRows: 'auto minmax(0, 1fr)', minHeight: 0 }}>
                    <FrameInspector
                        canEdit={Boolean(canEditAtlasFrames && selectedFrame && selectedFrameName)}
                        frame={selectedFrame}
                        image={image}
                        name={selectedFrameName}
                        onDuplicate={selectedFrameName ? () => handleDuplicateFrame(selectedFrameName) : undefined}
                        onNudge={handleSelectedFrameNudge}
                        onRemove={selectedFrameName && canEditAtlasFrames ? () => handleRemoveFrame(selectedFrameName) : undefined}
                        onUpdate={handleSelectedFrameRectUpdate}
                        uiScale={uiScale}
                    />
                    <section className="zerith-scrollbar" style={panelStyle}>
                        {descriptor && image ? (
                            <SpritesheetAnimationEditor
                                animations={descriptor.animations ?? {}}
                                frames={frames}
                                image={image}
                                onUpdateAnimations={(animations) => applyDescriptorUpdate({ ...descriptor, animations })}
                                selectedFrameName={selectedFrameName}
                                uiScale={uiScale}
                            />
                        ) : <div style={{ color: t.text.muted }}>Load source image to edit animations.</div>}
                    </section>
                </aside>
            </div>

            {(descriptorError || saveError) ? (
                <div style={{ color: t.text.muted }}>
                    {descriptorError ? `Descriptor error: ${descriptorError}` : undefined}
                    {descriptorError && saveError ? ' | ' : undefined}
                    {saveError ? `Save error: ${saveError}` : undefined}
                </div>
            ) : undefined}

            <ConfirmDialog
                cancelText="Close"
                confirmText="OK"
                message={frameDialogMessage ?? ''}
                onCancel={() => setFrameDialogMessage(undefined)}
                onConfirm={() => setFrameDialogMessage(undefined)}
                open={Boolean(frameDialogMessage)}
                title="Frame Validation"
            />
        </div>
    );
}

function FrameInspector({
    canEdit,
    frame,
    image,
    name,
    onDuplicate,
    onNudge,
    onRemove,
    onUpdate,
    uiScale,
}: {
    canEdit: boolean;
    frame: ManualFrameRect | undefined;
    image: HTMLImageElement | undefined;
    name: string | undefined;
    onDuplicate: (() => void) | undefined;
    onNudge: (dx: number, dy: number) => void;
    onRemove: (() => void) | undefined;
    onUpdate: (update: Partial<ManualFrameRect>) => void;
    uiScale: number;
}) {
    const iconSize = Math.max(14, Math.round(15 * uiScale));
    const disabled = !canEdit || !frame;

    return (
        <section style={{ ...panelStyle, display: 'grid', gap: 10 }}>
            <div style={{ alignItems: 'center', display: 'flex', gap: 8 }}>
                <SquareDashedMousePointer color={t.accent.orange} size={iconSize} />
                <strong style={{ color: t.text.primary }}>Frame Inspector</strong>
            </div>
            {frame && name ? (
                <>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ color: t.text.primary, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                        <div style={{ color: t.text.faint, fontSize: `${12 * uiScale}px` }}>
                            {frame.w}x{frame.h} @ {frame.x},{frame.y}
                            {image ? ` | sheet ${image.naturalWidth}x${image.naturalHeight}` : ''}
                        </div>
                    </div>
                    <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                        <RectNumberField disabled={disabled} label="X" onChange={(x) => onUpdate({ x })} uiScale={uiScale} value={frame.x} />
                        <RectNumberField disabled={disabled} label="Y" onChange={(y) => onUpdate({ y })} uiScale={uiScale} value={frame.y} />
                        <RectNumberField disabled={disabled} label="W" min={1} onChange={(w) => onUpdate({ w })} uiScale={uiScale} value={frame.w} />
                        <RectNumberField disabled={disabled} label="H" min={1} onChange={(h) => onUpdate({ h })} uiScale={uiScale} value={frame.h} />
                    </div>
                    <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                        <button disabled={disabled} onClick={() => onNudge(0, -1)} style={spritesheetButtonStyle({ disabled })} type="button">Y-</button>
                        <button disabled={disabled} onClick={() => onNudge(-1, 0)} style={spritesheetButtonStyle({ disabled })} type="button">X-</button>
                        <button disabled={disabled} onClick={() => onNudge(1, 0)} style={spritesheetButtonStyle({ disabled })} type="button">X+</button>
                        <button disabled={disabled} onClick={() => onNudge(0, 1)} style={spritesheetButtonStyle({ disabled })} type="button">Y+</button>
                        <button disabled={disabled || !onDuplicate} onClick={() => onDuplicate?.()} style={spritesheetButtonStyle({ disabled: disabled || !onDuplicate })} type="button">
                            <Copy size={iconSize} />
                            Copy
                        </button>
                        <button disabled={disabled || !onRemove} onClick={() => onRemove?.()} style={spritesheetButtonStyle({ disabled: disabled || !onRemove })} type="button">
                            <Trash2 size={iconSize} />
                            Remove
                        </button>
                    </div>
                </>
            ) : (
                <div style={{ color: t.text.muted }}>Select a frame to inspect.</div>
            )}
        </section>
    );
}

function inputStyle(uiScale: number): CSSProperties {
    return {
        background: t.bg.input,
        border: `1px solid ${t.border.input}`,
        borderRadius: t.radius.sm,
        color: t.text.primary,
        minWidth: 0,
        padding: `${5 * uiScale}px ${6 * uiScale}px`,
    };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object';
}

function RectNumberField({
    disabled,
    label,
    min = 0,
    onChange,
    uiScale,
    value,
}: {
    disabled: boolean;
    label: string;
    min?: number;
    onChange: (value: number) => void;
    uiScale: number;
    value: number;
}) {
    return (
        <label style={{ color: t.text.muted, display: 'grid', fontSize: `${12 * uiScale}px`, gap: 4 }}>
            <span>{label}</span>
            <input
                disabled={disabled}
                min={min}
                onChange={(event) => onChange(Number(event.target.value))}
                style={inputStyle(uiScale)}
                type="number"
                value={value}
            />
        </label>
    );
}

async function resolveImagePath(descriptorPath: string, source: string): Promise<string> {
    if (source.startsWith('http://') || source.startsWith('https://') || source.startsWith('data:') || source.startsWith('file:')) {
        return source;
    }
    if (/^[A-Za-z]:[\\/]/.test(source) || source.startsWith('/')) return source;
    const parent = await fsDirname(descriptorPath);
    return fsJoin(parent, source);
}

function shouldUseAnonymousCrossOrigin(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
}

function ToggleButton(properties: { active: boolean } & ToolButtonProperties) {
    return <ToolButton {...properties} title={`${properties.active ? 'Hide' : 'Show'} ${properties.label}`} />;
}

function ToolbarGroup({ children, style }: { children: ReactNode; style?: CSSProperties }) {
    return (
        <div style={{ alignItems: 'center', display: 'flex', gap: 6, ...style }}>
            {children}
        </div>
    );
}

function ToolButton({ active, disabled, icon: Icon, label, onClick, primary, title, uiScale }: ToolButtonProperties) {
    const iconSize = Math.max(14, Math.round(15 * uiScale));
    return (
        <button
            disabled={disabled}
            onClick={onClick}
            style={{
                ...spritesheetButtonStyle({ active, disabled }),
                background: primary ? t.accent.primary : (active ? t.bg.selected : t.bg.panel),
                border: primary ? `1px solid ${t.border.primaryBtn}` : `1px solid ${active ? t.accent.primary : t.border.button}`,
                color: primary ? '#fff' : t.text.normal,
                minHeight: Math.max(28, Math.round(28 * uiScale)),
                whiteSpace: 'nowrap',
            }}
            title={title ?? label}
            type="button"
        >
            <Icon size={iconSize} />
            <span>{label}</span>
        </button>
    );
}

const toolbarStyle = {
    alignItems: 'center',
    background: t.bg.panelAlt,
    border: `1px solid ${t.border.subtle}`,
    borderRadius: t.radius.md,
    display: 'flex',
    minHeight: 52,
    minWidth: 0,
    overflow: 'hidden',
    padding: '8px 10px',
} as const;

const panelStyle = {
    background: t.bg.panelAlt,
    border: `1px solid ${t.border.subtle}`,
    borderRadius: t.radius.md,
    minHeight: 0,
    overflow: 'auto',
    padding: 10,
} as const;


