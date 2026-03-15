import { convertFileSrc } from '@tauri-apps/api/core';
import { generateGridFrames, type SpritesheetDescriptor } from 'core';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { WorkbenchTab } from '../../store/workbench/types';

import { parseSpritesheetDescriptor } from '../../../../core/src/schemas/descriptorSchemas';
import { fsDirname, fsJoin, fsWriteTextFile } from '../../services/fs';
import { useProjectStore } from '../../store/storeBootstrap';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { SpritesheetAnimationEditor } from './SpritesheetAnimationEditor';
import { SpritesheetCanvas } from './SpritesheetCanvas';
import { SpritesheetFrameList } from './SpritesheetFrameList';
import { mergeFrameUpdates } from './spritesheetEditorModel';

type SpritesheetEditorPanelProperties = {
    tab: WorkbenchTab;
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

    useEffect(() => {
        const rawText = tab.textContent ?? '{}';
        latestSerializedReference.current = rawText;
        setSaveError(undefined);

        let parsedJson: unknown = {};
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
            setDescriptorRoot(typeof parsedJson === 'object' && parsedJson !== null ? parsedJson as Record<string, unknown> : {});
            setDescriptorError(parsedDescriptor.error);
            return;
        }

        const nextDescriptor = parsedDescriptor.data;
        setDescriptor(nextDescriptor);
        setDescriptorRoot(typeof parsedJson === 'object' && parsedJson !== null ? parsedJson as Record<string, unknown> : {});
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
        (async () => {
            try {
                setImageError(undefined);
                const resolvedPath = await resolveImagePath(tab.path, descriptor.source);
                if (disposed) return;
                setImagePath(resolvedPath);
                setImageUrl(/^(?:https?:|data:|blob:|file:)/.test(resolvedPath) ? resolvedPath : convertFileSrc(resolvedPath));
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
        };
    }, [descriptor, tab.path]);

    useEffect(() => {
        if (!imageUrl) return;
        let disposed = false;
        const element = new Image();
        setIsImageLoading(true);
        setImageError(undefined);
        element.addEventListener('load', () => {
            if (disposed) return;
            setImage(element);
            setIsImageLoading(false);
        });
        element.onerror = () => {
            if (disposed) return;
            setImage(undefined);
            setIsImageLoading(false);
            setImageError('Failed to load source image.');
        };
        element.src = imageUrl;

        return () => {
            disposed = true;
        };
    }, [imageUrl]);

    useEffect(() => {
        if (!selectedFrameName || frames[selectedFrameName]) return;
        setSelectedFrameName(frameNames[0]);
    }, [frameNames, frames, selectedFrameName]);

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
            globalThis.alert('Frame name is required.');
            return;
        }

        const existingFrames = descriptor.frames ?? {};
        if (existingFrames[name]) {
            globalThis.alert(`Frame "${name}" already exists.`);
            return;
        }

        const rectInput = globalThis.prompt('Frame rect (x,y,w,h)', '0,0,32,32');
        if (!rectInput) return;

        const values = rectInput.split(',').map((value) => Number(value.trim()));
        if (values.length !== 4 || values.some((value) => Number.isNaN(value))) {
            globalThis.alert('Rect must contain four numbers: x,y,w,h');
            return;
        }

        const [x, y, w, h] = values;
        if (x < 0 || y < 0 || w <= 0 || h <= 0) {
            globalThis.alert('x/y must be non-negative and w/h must be positive.');
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

    const handleRemoveFrame = (name: string) => {
        if (!descriptor || descriptor.format !== 'atlas') return;
        const existingFrames = descriptor.frames ?? {};
        if (!existingFrames[name]) return;

        const nextFrames = mergeFrameUpdates(existingFrames, { [name]: undefined });

        applyDescriptorUpdate({ ...descriptor, frames: nextFrames });
    };

    return (
        <div style={{ display: 'grid', gap: 12, gridTemplateRows: 'auto 1fr', height: '100%', padding: 12 }}>
            <div style={{ alignItems: 'center', display: 'flex', gap: 8 }}>
                <strong style={{ color: t.text.primary, marginRight: 'auto' }}>Spritesheet Editor</strong>
                <button onClick={() => setZoomLevel((value) => Math.max(0.25, value - 0.25))}>-</button>
                <span style={{ color: t.text.muted, width: 60 }}>{Math.round(zoomLevel * 100)}%</span>
                <button onClick={() => setZoomLevel((value) => Math.min(8, value + 0.25))}>+</button>
                <label style={{ color: t.text.muted }}>
                    <input checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} type="checkbox" /> Grid
                </label>
                <label style={{ color: t.text.muted }}>
                    <input
                        checked={showChromaPreview}
                        disabled={!descriptor?.chromaKey}
                        onChange={(event) => setShowChromaPreview(event.target.checked)}
                        type="checkbox"
                    />
                    Chroma
                </label>
                <button disabled={!descriptor || isSaving} onClick={() => void handleSave()}>{isSaving ? 'Saving...' : 'Save'}</button>
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '240px minmax(0, 1fr) 300px', minHeight: 0 }}>
                <section className="zerith-scrollbar" style={panelStyle}>
                    {image ? null : <div style={{ color: t.text.muted }}>Load source image to preview frames.</div>}
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
                    ) : null}
                </section>

                <section className="zerith-scrollbar" style={panelStyle}>
                    {isImageLoading ? <div style={{ color: t.text.muted }}>Loading source image...</div> : null}
                    {!isImageLoading && imageError ? <div style={{ color: t.text.muted }}>{imageError}</div> : null}
                    {!isImageLoading && !imageError && imagePath ? <div style={{ color: t.text.muted }}>{imagePath}</div> : null}
                    {!isImageLoading && !imageError && image && imagePath ? (
                        <SpritesheetCanvas
                            chromaKey={showChromaPreview ? descriptor?.chromaKey : undefined}
                            chromaTolerance={descriptor?.chromaTolerance}
                            frames={frames}
                            image={image}
                            onSelectFrame={setSelectedFrameName}
                            panOffset={panOffset}
                            selectedFrame={selectedFrameName}
                            setPanOffset={setPanOffset}
                            setZoom={setZoomLevel}
                            showGrid={showGrid && descriptor?.format === 'grid'}
                            uiScale={uiScale}
                            zoom={zoomLevel}
                        />
                    ) : null}
                </section>

                <section className="zerith-scrollbar" style={panelStyle}>
                    {descriptor && image ? (
                        <SpritesheetAnimationEditor
                            animations={descriptor.animations ?? {}}
                            frames={frames}
                            image={image}
                            onUpdateAnimations={(animations) => applyDescriptorUpdate({ ...descriptor, animations })}
                            uiScale={uiScale}
                        />
                    ) : <div style={{ color: t.text.muted }}>Load source image to edit animations.</div>}
                </section>
            </div>

            {(descriptorError || saveError) ? (
                <div style={{ color: t.text.muted }}>
                    {descriptorError ? `Descriptor error: ${descriptorError}` : null}
                    {descriptorError && saveError ? ' | ' : null}
                    {saveError ? `Save error: ${saveError}` : null}
                </div>
            ) : null}
        </div>
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

const panelStyle = {
    background: t.bg.panelAlt,
    border: `1px solid ${t.border.subtle}`,
    borderRadius: t.radius.md,
    minHeight: 0,
    overflow: 'auto',
    padding: 10,
} as const;
