import { type AudiosheetDescriptor, parseAudiosheetDescriptor } from 'core';
import { type MouseEvent, type PointerEvent, type RefObject, useEffect, useMemo, useRef, useState, type WheelEvent } from 'react';

import type { WorkbenchTab } from '../../store/workbench/types';

import { type AudiosheetShortcutAction, audiosheetShortcutEventName } from '../../services/audiosheetShortcuts';
import { fsDirname, fsJoin, fsReadBinaryFile, fsWriteTextFile } from '../../services/fs';
import { useProjectStore } from '../../store/storeBootstrap';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { styles } from '../../theme/styleHelpers';
import { ConfirmDialog } from '../ConfirmDialog';
import { computeCueDragUpdate, findCueHandleHit, formatTimestamp, validateCueOverlaps, waveformXToTime } from './audiosheetEditorModel';
import { type ActiveWaveformHandle, AudioWaveformCanvas, computeWaveformPeaks } from './AudioWaveformCanvas';

const WAVEFORM_BINS = 640;
const WAVEFORM_HANDLE_TOLERANCE_PX = 8;
type AudiosheetEditorPanelProperties = { tab: WorkbenchTab; };

type WaveformDragState =
    | { mode: 'cue'; pointerId: number; }
    | { mode: 'pan'; pointerId: number; startViewportStart: number; x: number; }
    | { mode: 'scrub'; pointerId: number; };

export function AudiosheetEditorPanel({ tab }: AudiosheetEditorPanelProperties) {
    const clearFileDirty = useProjectStore((state) => state.clearFileDirty);
    const audiosheetShortcutTargetMode = useSettingsStore((state) => state.audiosheetShortcutTargetMode);
    const uiScale = useSettingsStore((state) => state.uiScale);
    const updateTabContent = useWorkbenchStore((state) => state.updateTabContent);
    const latestSerialized = useRef(tab.textContent ?? '{}');
    const contextReference = useRef<AudioContext | undefined>(undefined);
    const sourceReference = useRef<AudioBufferSourceNode | undefined>(undefined);
    const frameReference = useRef<number | undefined>(undefined);
    const playStartReference = useRef(0);
    const playOffsetReference = useRef(0);
    const playEndReference = useRef<number | undefined>(undefined);
    const dragStateReference = useRef<undefined | WaveformDragState>(undefined);
    const dragHandleReference = useRef<ActiveWaveformHandle | undefined>(undefined);
    const pointerDownXReference = useRef(0);
    const suppressClickReference = useRef(false);
    const skipNextLocalSyncReference = useRef(false);
    const resumeAfterScrubReference = useRef(false);
    const waveformCursorSecondsReference = useRef<number | undefined>(undefined);

    const [descriptor, setDescriptor] = useState<AudiosheetDescriptor>();
    const [root, setRoot] = useState<Record<string, unknown>>({});
    const [descriptorError, setDescriptorError] = useState<string>();
    const [saveError, setSaveError] = useState<string>();
    const [isSaving, setIsSaving] = useState(false);
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer>();
    const [audioPath, setAudioPath] = useState<string>();
    const [audioError, setAudioError] = useState<string>();
    const [scrub, setScrub] = useState(0);
    const [selectedCue, setSelectedCue] = useState<string>();
    const [selectionAnchor, setSelectionAnchor] = useState<number>();
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeHandle, setActiveHandle] = useState<ActiveWaveformHandle>();
    const [waveformZoom, setWaveformZoom] = useState(1);
    const [waveformViewportStart, setWaveformViewportStart] = useState(0);
    const [validationMessage, setValidationMessage] = useState<string>();

    const cueEntries = useMemo(() => Object.entries(descriptor?.cues ?? {}).toSorted((a, b) => a[1].start - b[1].start), [descriptor?.cues]);
    const cueMarkers = useMemo(
        () => cueEntries.map(([name, cue]) => {
            const start = Math.max(0, cue.start);
            const fallbackEnd = audioBuffer?.duration ?? start + 0.01;
            const duration = cue.duration === undefined ? Math.max(0.01, fallbackEnd - start) : Math.max(0.01, cue.duration);
            return { end: start + duration, name, start };
        }),
        [audioBuffer?.duration, cueEntries],
    );
    const overlapIssues = useMemo(() => validateCueOverlaps(descriptor?.cues ?? {}), [descriptor?.cues]);
    const totalDuration = audioBuffer?.duration ?? 0;
    const visibleDuration = totalDuration <= 0 ? 0 : clamp(totalDuration / waveformZoom, 0.1, totalDuration);
    const maxViewportStart = Math.max(0, totalDuration - visibleDuration);
    const waveformViewport = { duration: visibleDuration, start: clamp(waveformViewportStart, 0, maxViewportStart) };
    const projectedWaveformMarkers = useMemo(() => {
        if (waveformViewport.duration <= 0) return [];
        const viewportStart = waveformViewport.start;
        const viewportEnd = waveformViewport.start + waveformViewport.duration;

        return cueMarkers
            .filter((cue) => cue.end >= viewportStart && cue.start <= viewportEnd)
            .map((cue) => ({
                end: clamp(cue.end - viewportStart, 0, waveformViewport.duration),
                name: cue.name,
                start: clamp(cue.start - viewportStart, 0, waveformViewport.duration),
            }));
    }, [cueMarkers, waveformViewport.duration, waveformViewport.start]);
    const projectedScrub = clamp(scrub - waveformViewport.start, 0, waveformViewport.duration);
    const projectedSelectionAnchor = selectionAnchor === undefined
        ? undefined
        : clamp(selectionAnchor - waveformViewport.start, 0, waveformViewport.duration);
    const projectedPeaks = useMemo(() => {
        if (!audioBuffer || waveformViewport.duration <= 0) return [];

        const channelData = audioBuffer.getChannelData(0);
        if (channelData.length === 0 || audioBuffer.duration <= 0) return [];

        const clipStartSeconds = waveformViewport.start;
        const clipEndSeconds = waveformViewport.start + waveformViewport.duration;
        const startIndex = Math.floor((clipStartSeconds / audioBuffer.duration) * channelData.length);
        const endIndex = Math.ceil((clipEndSeconds / audioBuffer.duration) * channelData.length);
        const safeStartIndex = clamp(startIndex, 0, channelData.length - 1);
        const safeEndIndex = clamp(endIndex, safeStartIndex + 1, channelData.length);

        return computeWaveformPeaks(channelData.subarray(safeStartIndex, safeEndIndex), WAVEFORM_BINS);
    }, [audioBuffer, waveformViewport.duration, waveformViewport.start]);

    useEffect(() => {
        setWaveformViewportStart((current) => clamp(current, 0, maxViewportStart));
    }, [maxViewportStart]);

    const stopPlayback = () => {
        if (sourceReference.current) {
            try {
                sourceReference.current.stop();
            } catch {
                // Ignore stop() on already-ended nodes.
            }
            sourceReference.current.disconnect();
            sourceReference.current = undefined;
        }
        if (frameReference.current !== undefined) cancelAnimationFrame(frameReference.current);
        frameReference.current = undefined;
        playEndReference.current = undefined;
        setIsPlaying(false);
    };

    const applyDescriptorUpdate = (next: AudiosheetDescriptor) => {
        setDescriptor(next);
        const nextRoot = { ...root, ...next };
        const nextText = `${JSON.stringify(nextRoot, undefined, 4)}\n`;
        latestSerialized.current = nextText;
        skipNextLocalSyncReference.current = true;
        setRoot(nextRoot);
        updateTabContent(tab.id, nextText);
    };

    useEffect(() => {
        const rawText = tab.textContent ?? '{}';

        if (skipNextLocalSyncReference.current && rawText === latestSerialized.current) {
            skipNextLocalSyncReference.current = false;
            return;
        }

        latestSerialized.current = rawText;
        setDescriptor(undefined);
        setDescriptorError(undefined);
        setSaveError(undefined);
        setSelectionAnchor(undefined);
        setSelectedCue(undefined);
        setScrub(0);

        let parsed: unknown;
        try {
            parsed = JSON.parse(rawText);
        } catch {
            setRoot({});
            setDescriptorError('Descriptor JSON is invalid.');
            return;
        }
        const result = parseAudiosheetDescriptor(parsed);
        if (!result.success) {
            setRoot(typeof parsed === 'object' && parsed ? parsed as Record<string, unknown> : {});
            setDescriptorError(result.error);
            return;
        }
        setRoot(typeof parsed === 'object' && parsed ? parsed as Record<string, unknown> : {});
        setDescriptor(result.data);
        setSelectedCue(Object.keys(result.data.cues)[0]);
    }, [tab.id, tab.textContent]);

    const descriptorSource = descriptor?.source;

    useEffect(() => {
        stopPlayback();
        setAudioBuffer(undefined);
        setAudioPath(undefined);
        setAudioError(undefined);
        if (!descriptorSource) return;
        let canceled = false;

        void (async () => {
            try {
                const sourcePath = await resolveAudioPath(tab.path, descriptorSource);
                const bytes = await loadAudioBytes(sourcePath);
                const decoded = await getAudioContext(contextReference).decodeAudioData(bytes);
                if (canceled) return;
                setAudioPath(sourcePath);
                setAudioBuffer(decoded);
            } catch (error) {
                if (!canceled) setAudioError(error instanceof Error ? error.message : 'Failed to decode source audio.');
            }
        })();

        return () => {
            canceled = true;
        };
    }, [descriptorSource, tab.path]);

    useEffect(() => () => {
        stopPlayback();
        if (contextReference.current) {
            void contextReference.current.close();
            contextReference.current = undefined;
        }
    }, []);

    const play = async (from: number, to?: number) => {
        if (!audioBuffer) return;
        const context = getAudioContext(contextReference);
        if (context.state === 'suspended') await context.resume();

        stopPlayback();
        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(context.destination);
        sourceReference.current = source;
        playStartReference.current = context.currentTime;
        playOffsetReference.current = clamp(from, 0, audioBuffer.duration);
        playEndReference.current = to;

        source.addEventListener('ended', () => {
            const endedAt = playEndReference.current;
            stopPlayback();
            if (endedAt !== undefined) setScrub(endedAt);
        });

        const clipDuration = to === undefined ? undefined : Math.max(0, to - playOffsetReference.current);
        source.start(0, playOffsetReference.current, clipDuration);
        setIsPlaying(true);

        const sync = () => {
            if (!sourceReference.current) return;
            const elapsed = context.currentTime - playStartReference.current;
            const next = playOffsetReference.current + elapsed;
            setScrub(playEndReference.current === undefined ? next : Math.min(next, playEndReference.current));
            frameReference.current = requestAnimationFrame(sync);
        };
        frameReference.current = requestAnimationFrame(sync);
    };

    const pause = () => {
        if (isPlaying && contextReference.current && audioBuffer) {
            const elapsed = contextReference.current.currentTime - playStartReference.current;
            setScrub(clamp(playOffsetReference.current + elapsed, 0, audioBuffer.duration));
        }
        stopPlayback();
    };

    const handleSave = async () => {
        if (!descriptor) return;
        setIsSaving(true);
        setSaveError(undefined);
        try {
            await fsWriteTextFile(tab.path, latestSerialized.current);
            updateTabContent(tab.id, latestSerialized.current, { markDirty: false });
            clearFileDirty(tab.path);
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'Failed to save descriptor.');
        } finally {
            setIsSaving(false);
        }
    };

    const updateCue = (name: string, changes: Partial<AudiosheetDescriptor['cues'][string]>) => {
        if (!descriptor?.cues[name]) return;
        applyDescriptorUpdate({ ...descriptor, cues: { ...descriptor.cues, [name]: { ...descriptor.cues[name], ...changes } } });
    };

    const renameCue = (name: string, nextRaw: string) => {
        if (!descriptor) return;
        const nextName = nextRaw.trim();
        if (!nextName || nextName === name) return;
        if (descriptor.cues[nextName]) {
            setValidationMessage(`Cue "${nextName}" already exists.`);
            return;
        }
        const cues = Object.fromEntries(Object.entries(descriptor.cues).map(([key, cue]) => [key === name ? nextName : key, cue]));
        applyDescriptorUpdate({ ...descriptor, cues });
        setSelectedCue((current) => (current === name ? nextName : current));
    };

    const addCueFromSelection = (a: number, b: number) => {
        if (!descriptor) return;
        const start = Math.max(0, Math.min(a, b));
        const duration = Math.max(0.01, Math.abs(a - b));
        const name = generateDefaultCueName(descriptor.cues);
        applyDescriptorUpdate({ ...descriptor, cues: { ...descriptor.cues, [name]: { duration, start, volume: 1 } } });
        setSelectedCue(name);
        setScrub(start);
    };

    const deleteCue = (name: string) => {
        if (!descriptor?.cues[name]) return;

        const nextCueEntries = Object.entries(descriptor.cues)
            .filter(([cueName]) => cueName !== name)
            .toSorted((a, b) => a[1].start - b[1].start);
        const nextCues = Object.fromEntries(nextCueEntries);

        applyDescriptorUpdate({ ...descriptor, cues: nextCues });

        const fallbackSelection = nextCueEntries[0]?.[0];
        const nextSelection = selectedCue === name ? fallbackSelection : selectedCue;
        setSelectedCue(nextSelection);

        if (nextSelection && nextCues[nextSelection]) {
            setScrub(nextCues[nextSelection].start);
        }
    };

    const applyBoundaryShortcut = (side: 'left' | 'right', targetTimeRaw: number) => {
        if (!descriptor) return;
        const clipDuration = Math.max(0.01, audioBuffer?.duration ?? (targetTimeRaw + 0.5));
        const targetTime = clamp(targetTimeRaw, 0, clipDuration);

        const orderedByStart = cueMarkers.toSorted((a, b) => a.start - b.start);
        if (side === 'left') {
            const targetCue = orderedByStart
                .filter((cue) => cue.start >= targetTime)
                .toSorted((a, b) => (a.start - targetTime) - (b.start - targetTime))[0]
                ?? orderedByStart.findLast((cue) => cue.start <= targetTime);
            if (targetCue && descriptor.cues[targetCue.name]) {
                updateCue(
                    targetCue.name,
                    computeCueDragUpdate(descriptor.cues[targetCue.name], 'start', targetTime, audioBuffer?.duration),
                );
                setSelectedCue(targetCue.name);
                setScrub(targetTime);
                return;
            }

            const defaultSpan = 0.5;
            const cueEnd = clamp(targetTime + defaultSpan, 0.01, clipDuration);
            const cueStart = clamp(targetTime, 0, cueEnd - 0.01);

            const name = generateDefaultCueName(descriptor.cues);
            applyDescriptorUpdate({
                ...descriptor,
                cues: {
                    ...descriptor.cues,
                    [name]: {
                        duration: Math.max(0.01, cueEnd - cueStart),
                        start: cueStart,
                        volume: 1,
                    },
                },
            });
            setSelectedCue(name);
            setScrub(targetTime);
            return;
        }

        const rightCue = orderedByStart.find((cue) => cue.end >= targetTime);
        if (rightCue && descriptor.cues[rightCue.name]) {
            updateCue(
                rightCue.name,
                computeCueDragUpdate(descriptor.cues[rightCue.name], 'end', targetTime, audioBuffer?.duration),
            );
            setSelectedCue(rightCue.name);
            setScrub(targetTime);
            return;
        }

        const leftCue = orderedByStart.findLast((cue) => cue.start <= targetTime);
        if (leftCue && descriptor.cues[leftCue.name]) {
            updateCue(
                leftCue.name,
                computeCueDragUpdate(descriptor.cues[leftCue.name], 'end', targetTime, audioBuffer?.duration),
            );
            setSelectedCue(leftCue.name);
            setScrub(targetTime);
            return;
        }

        const defaultSpan = 0.5;
        const cueEnd = clamp(targetTime, 0.01, clipDuration);
        const cueStart = clamp(targetTime - defaultSpan, 0, cueEnd - 0.01);

        const name = generateDefaultCueName(descriptor.cues);
        applyDescriptorUpdate({
            ...descriptor,
            cues: {
                ...descriptor.cues,
                [name]: {
                    duration: Math.max(0.01, cueEnd - cueStart),
                    start: cueStart,
                    volume: 1,
                },
            },
        });
        setSelectedCue(name);
        setScrub(targetTime);
    };

    const getShortcutTargetTime = () => {
        if (audiosheetShortcutTargetMode === 'playhead') {
            return clamp(scrub, 0, Math.max(0, totalDuration));
        }

        return clamp(waveformCursorSecondsReference.current ?? scrub, 0, Math.max(0, totalDuration));
    };

    const applyZoomAtRatio = (nextZoomRaw: number, ratioRaw: number) => {
        if (totalDuration <= 0) return;

        const ratio = clamp(ratioRaw, 0, 1);
        const nextZoom = clamp(nextZoomRaw, 1, 16);
        const currentVisible = clamp(totalDuration / waveformZoom, 0.1, totalDuration);
        const currentStart = clamp(waveformViewportStart, 0, Math.max(0, totalDuration - currentVisible));
        const anchorTime = currentStart + (currentVisible * ratio);

        const nextVisible = clamp(totalDuration / nextZoom, 0.1, totalDuration);
        const nextMaxStart = Math.max(0, totalDuration - nextVisible);
        const nextStart = clamp(anchorTime - (nextVisible * ratio), 0, nextMaxStart);

        setWaveformZoom(nextZoom);
        setWaveformViewportStart(nextStart);
    };

    const onWaveformWheel = (event: WheelEvent<HTMLCanvasElement>) => {
        if (totalDuration <= 0) return;

        event.preventDefault();
        const bounds = event.currentTarget.getBoundingClientRect();
        const ratio = bounds.width <= 0 ? 0.5 : clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
        waveformCursorSecondsReference.current = waveformXToTime(event.clientX - bounds.left, waveformViewport.duration, Math.max(bounds.width, 1)) + waveformViewport.start;
        const zoomDelta = event.deltaY < 0 ? 1.15 : (1 / 1.15);
        applyZoomAtRatio(waveformZoom * zoomDelta, ratio);
    };

    const onWaveformClick = (event: MouseEvent<HTMLCanvasElement>) => {
        if (suppressClickReference.current) {
            suppressClickReference.current = false;
            return;
        }

        const duration = audioBuffer?.duration;
        if (!duration) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const clicked = waveformXToTime(event.clientX - bounds.left, waveformViewport.duration, Math.max(bounds.width, 1)) + waveformViewport.start;
        waveformCursorSecondsReference.current = clicked;
        if (!event.shiftKey) return void setScrub(clicked);
        if (selectionAnchor === undefined) return void setSelectionAnchor(clicked);
        addCueFromSelection(selectionAnchor, clicked);
        setSelectionAnchor(undefined);
    };

    const onWaveformPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
        const duration = audioBuffer?.duration;
        if (!duration || (event.button !== 0 && event.button !== 2)) return;

        const bounds = event.currentTarget.getBoundingClientRect();
        const safeWidth = Math.max(bounds.width, 1);
        const pointerX = clamp(event.clientX - bounds.left, 0, safeWidth);
        const pointerSeconds = waveformXToTime(pointerX, waveformViewport.duration, safeWidth) + waveformViewport.start;
        waveformCursorSecondsReference.current = pointerSeconds;

        pointerDownXReference.current = pointerX;
        suppressClickReference.current = false;

        if (event.button === 2) {
            dragStateReference.current = {
                mode: 'pan',
                pointerId: event.pointerId,
                startViewportStart: waveformViewport.start,
                x: pointerX,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
            event.preventDefault();
            return;
        }

        const handleHit = findCueHandleHit(projectedWaveformMarkers, pointerX, waveformViewport.duration, safeWidth, WAVEFORM_HANDLE_TOLERANCE_PX);
        if (handleHit) {
            const nextActiveHandle: ActiveWaveformHandle = { cueName: handleHit.cueName, handle: handleHit.handle };
            dragHandleReference.current = nextActiveHandle;
            dragStateReference.current = { mode: 'cue', pointerId: event.pointerId };
            setActiveHandle(nextActiveHandle);
            setSelectedCue(handleHit.cueName);
            event.currentTarget.setPointerCapture(event.pointerId);
            event.preventDefault();
            return;
        }

        if (event.shiftKey) return;

        resumeAfterScrubReference.current = false;
        if (isPlaying) {
            resumeAfterScrubReference.current = true;
            pause();
        }

        dragStateReference.current = { mode: 'scrub', pointerId: event.pointerId };
        setScrub(pointerSeconds);
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
    };

    const onWaveformPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
        const duration = audioBuffer?.duration;
        if (!duration) return;

        const bounds = event.currentTarget.getBoundingClientRect();
        const safeWidth = Math.max(bounds.width, 1);
        const pointerX = clamp(event.clientX - bounds.left, 0, safeWidth);
        const pointerSeconds = waveformXToTime(pointerX, waveformViewport.duration, safeWidth) + waveformViewport.start;
        waveformCursorSecondsReference.current = pointerSeconds;

        const dragState = dragStateReference.current;
        if (!dragState || dragState.pointerId !== event.pointerId) return;

        if (Math.abs(pointerX - pointerDownXReference.current) > 2) suppressClickReference.current = true;

        if (dragState.mode === 'pan') {
            const deltaSeconds = ((pointerX - dragState.x) / safeWidth) * waveformViewport.duration;
            setWaveformViewportStart(clamp(dragState.startViewportStart - deltaSeconds, 0, maxViewportStart));
            return;
        }

        if (dragState.mode === 'scrub') {
            setScrub(pointerSeconds);
            return;
        }

        const active = dragHandleReference.current;
        if (!descriptor || !active || !descriptor.cues[active.cueName]) return;
        const cue = descriptor.cues[active.cueName];
        updateCue(active.cueName, computeCueDragUpdate(cue, active.handle, pointerSeconds, duration));
        setScrub(pointerSeconds);
    };

    const onWaveformPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
        const dragState = dragStateReference.current;
        if (!dragState || dragState.pointerId !== event.pointerId) return;

        const duration = audioBuffer?.duration;
        const bounds = event.currentTarget.getBoundingClientRect();
        const safeWidth = Math.max(bounds.width, 1);
        const pointerX = clamp(event.clientX - bounds.left, 0, safeWidth);
        const releaseSeconds = duration
            ? waveformXToTime(pointerX, waveformViewport.duration, safeWidth) + waveformViewport.start
            : scrub;
        waveformCursorSecondsReference.current = releaseSeconds;

        dragStateReference.current = undefined;
        dragHandleReference.current = undefined;
        setActiveHandle(undefined);

        if (dragState.mode === 'pan') {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
            return;
        }

        if (dragState.mode === 'scrub') {
            setScrub(releaseSeconds);
            if (resumeAfterScrubReference.current && duration) {
                resumeAfterScrubReference.current = false;
                void play(releaseSeconds);
            }
        }

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    useEffect(() => {
        const handleAudiosheetShortcut = (action: AudiosheetShortcutAction) => {
            if (action === 'togglePlayPause') {
                if (!audioBuffer) return;
                if (isPlaying) {
                    pause();
                } else {
                    void play(scrub);
                }
                return;
            }

            if (action === 'setLeftBoundary') {
                setSelectionAnchor(undefined);
                applyBoundaryShortcut('left', getShortcutTargetTime());
                return;
            }

            if (action === 'setRightBoundary') {
                setSelectionAnchor(undefined);
                applyBoundaryShortcut('right', getShortcutTargetTime());
                return;
            }

            if (selectedCue) {
                deleteCue(selectedCue);
            }
        };

        const onShortcut = (event: Event) => {
            const customEvent = event as CustomEvent<{ action: AudiosheetShortcutAction }>;
            handleAudiosheetShortcut(customEvent.detail.action);
        };

        globalThis.addEventListener(audiosheetShortcutEventName, onShortcut);
        return () => {
            globalThis.removeEventListener(audiosheetShortcutEventName, onShortcut);
        };
    }, [
        applyBoundaryShortcut,
        audioBuffer,
        deleteCue,
        descriptor,
        getShortcutTargetTime,
        isPlaying,
        pause,
        play,
        scrub,
        selectedCue,
    ]);

    const selectedCueData = selectedCue ? descriptor?.cues[selectedCue] : undefined;
    const selectedCueEnd = selectedCueData ? selectedCueData.start + (selectedCueData.duration ?? Math.max(0, (audioBuffer?.duration ?? selectedCueData.start) - selectedCueData.start)) : 0;
    const format = descriptor?.source.split('.').pop()?.toUpperCase() ?? 'unknown';
    const buttonStyle = (disabled: boolean, primary = false) => ({
        ...styles.buttonBase(uiScale),
        background: primary ? t.accent.primary : 'transparent',
        border: primary ? 'none' : `1px solid ${t.border.button}`,
        color: primary ? '#fff' : t.text.normal,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
    });
    const iconButtonStyle = (disabled: boolean) => ({
        ...styles.iconButton(uiScale),
        border: `1px solid ${t.border.button}`,
        borderRadius: t.radius.sm,
        color: t.text.normal,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
    });

    return (
        <div style={{ display: 'grid', gap: 12, gridTemplateRows: 'auto auto 1fr', height: '100%', padding: 12 }}>
            <div style={{ alignItems: 'center', display: 'flex', gap: 8 }}>
                <strong style={{ color: t.text.primary, marginRight: 'auto' }}>Audiosheet Editor</strong>
                <button disabled={!audioBuffer || isPlaying} onClick={() => void play(scrub)} style={buttonStyle(!audioBuffer || isPlaying)} type="button">Play</button>
                <button disabled={!audioBuffer || !isPlaying} onClick={pause} style={buttonStyle(!audioBuffer || !isPlaying)} type="button">Pause</button>
                <button disabled={!audioBuffer} onClick={() => { stopPlayback(); setScrub(0); }} style={buttonStyle(!audioBuffer)} type="button">Stop</button>
                <button disabled={!audioBuffer || !selectedCueData} onClick={() => void play(selectedCueData?.start ?? 0, selectedCueEnd)} style={buttonStyle(!audioBuffer || !selectedCueData)} type="button">Play Cue</button>
                <button disabled={!selectedCueData} onClick={() => selectedCue && deleteCue(selectedCue)} style={buttonStyle(!selectedCueData)} type="button">Delete Cue</button>
                <button disabled={!descriptor || isSaving} onClick={() => void handleSave()} style={buttonStyle(!descriptor || isSaving, true)} type="button">{isSaving ? 'Saving...' : 'Save'}</button>
            </div>

            <section style={panelStyle}>
                <div style={{ alignItems: 'center', color: t.text.muted, display: 'flex', gap: 8, marginBottom: 6 }}>
                    <span>Wheel to zoom, right-drag to pan view, left-drag to scrub. Drag cue handles to retime. Shift+click creates ranges. Q/E nudge nearest left/right boundary.</span>
                    <span style={{ marginLeft: 'auto' }}>Zoom</span>
                    <button onClick={() => applyZoomAtRatio(waveformZoom / 1.5, 0.5)} style={iconButtonStyle(false)} type="button">-</button>
                    <input max={16} min={1} onChange={(event) => applyZoomAtRatio(Number(event.target.value) || 1, 0.5)} step={0.25} style={{ width: 120 }} type="range" value={waveformZoom} />
                    <button onClick={() => applyZoomAtRatio(waveformZoom * 1.5, 0.5)} style={iconButtonStyle(false)} type="button">+</button>
                    <span>{waveformZoom.toFixed(2)}x</span>
                </div>
                <AudioWaveformCanvas activeHandle={activeHandle} cues={projectedWaveformMarkers} durationSeconds={waveformViewport.duration} onClick={onWaveformClick} onContextMenu={preventWaveformContextMenu} onPointerDown={onWaveformPointerDown} onPointerMove={onWaveformPointerMove} onPointerUp={onWaveformPointerUp} onWheel={onWaveformWheel} peaks={projectedPeaks} scrubSeconds={projectedScrub} selectedCue={selectedCue} selectionAnchor={projectedSelectionAnchor} />
                <div style={{ color: t.text.muted, display: 'grid', gap: 4, gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', marginTop: 8 }}>
                    <span>Scrub: {formatTimestamp(scrub)}</span><span>Duration: {formatTimestamp(audioBuffer?.duration ?? 0)}</span>
                    <span>Rate: {audioBuffer?.sampleRate ? `${audioBuffer.sampleRate} Hz` : 'n/a'}</span><span>Channels: {audioBuffer?.numberOfChannels ?? 0}</span><span>Format: {format}</span>
                </div>
                {audioPath ? <div style={{ color: t.text.faint, marginTop: 6 }}>{audioPath}</div> : undefined}
                {overlapIssues.length > 0 ? <div style={{ color: '#fbbf24', marginTop: 6 }}>Overlap warning: {overlapIssues.length} cue range(s) overlap.</div> : undefined}
            </section>

            <section className="zerith-scrollbar" style={{ ...panelStyle, minHeight: 0, overflow: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead><tr style={{ color: t.text.muted, textAlign: 'left' }}><th>Name</th><th>Start (s)</th><th>Duration</th><th>Loop</th><th>Volume</th><th>Actions</th></tr></thead>
                    <tbody>{cueEntries.map(([name, cue]) => (
                        <tr key={name} onClick={() => { setSelectedCue(name); setScrub(cue.start); }} style={{ background: selectedCue === name ? t.bg.selected : 'transparent' }}>
                            <td><input defaultValue={name} onBlur={(event) => renameCue(name, event.target.value)} style={inputStyle} /></td>
                            <td><input onChange={(event) => updateCue(name, { start: Math.max(0, Number(event.target.value) || 0) })} step={0.01} style={inputStyle} type="number" value={cue.start} /></td>
                            <td><input onChange={(event) => updateCue(name, { duration: event.target.value === '' ? undefined : Math.max(0.01, Number(event.target.value) || 0.01) })} step={0.01} style={inputStyle} type="number" value={cue.duration ?? ''} /></td>
                            <td><input checked={Boolean(cue.loop)} onChange={(event) => updateCue(name, { loop: event.target.checked || undefined })} type="checkbox" /></td>
                            <td><input onChange={(event) => updateCue(name, { volume: event.target.value === '' ? undefined : Math.max(0, Number(event.target.value) || 0) })} step={0.05} style={inputStyle} type="number" value={cue.volume ?? ''} /></td>
                            <td style={{ display: 'flex', gap: 6 }}>
                                <button
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setSelectedCue(name);
                                        setScrub(cue.start);
                                    }}
                                    style={iconButtonStyle(false)}
                                    type="button"
                                >
                                    Seek
                                </button>
                                <button
                                    disabled={!audioBuffer}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        const cueEnd = cue.start + (cue.duration ?? Math.max(0, (audioBuffer?.duration ?? cue.start) - cue.start));
                                        void play(cue.start, cueEnd);
                                    }}
                                    style={buttonStyle(!audioBuffer)}
                                    type="button"
                                >
                                    Play
                                </button>
                                <button
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        deleteCue(name);
                                    }}
                                    style={buttonStyle(false)}
                                    type="button"
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    ))}</tbody>
                </table>
                {cueEntries.length === 0 ? <div style={{ color: t.text.faint, marginTop: 8 }}>No cues. Shift+click waveform to add one.</div> : undefined}
            </section>

            {(descriptorError || audioError || saveError || selectionAnchor !== undefined) ? (
                <div style={{ color: t.text.muted }}>
                    {descriptorError ? `Descriptor error: ${descriptorError}` : undefined}{audioError ? ` Audio error: ${audioError}` : undefined}{saveError ? ` Save error: ${saveError}` : undefined}
                    {selectionAnchor === undefined ? undefined : ` Selection start: ${formatTimestamp(selectionAnchor)} (Shift+click again to set cue end)`}
                </div>
            ) : undefined}

            <ConfirmDialog
                cancelText="Close"
                confirmText="OK"
                message={validationMessage ?? ''}
                onCancel={() => setValidationMessage(undefined)}
                onConfirm={() => setValidationMessage(undefined)}
                open={Boolean(validationMessage)}
                title="Cue Validation"
            />
        </div>
    );
}

function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
function generateDefaultCueName(cues: AudiosheetDescriptor['cues']): string {
    let index = Object.keys(cues).length + 1;
    while (cues[`cue_${index}`]) index += 1;
    return `cue_${index}`;
}
function getAudioContext(reference: RefObject<AudioContext | undefined>): AudioContext { if (!reference.current) reference.current = new AudioContext(); return reference.current; }
async function loadAudioBytes(path: string): Promise<ArrayBuffer> {
    if (/^(?:https?:|data:|blob:|file:)/.test(path)) {
        const response = await fetch(path);
        return response.arrayBuffer();
    }
    const bytes = await fsReadBinaryFile(path);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
async function resolveAudioPath(descriptorPath: string, source: string): Promise<string> {
    if (/^(?:https?:|data:|blob:|file:)/.test(source)) return source;
    if (/^[A-Za-z]:[\\/]/.test(source) || source.startsWith('/')) return source;
    const parent = await fsDirname(descriptorPath);
    return fsJoin(parent, source);
}

const panelStyle = { background: t.bg.panelAlt, border: `1px solid ${t.border.subtle}`, borderRadius: t.radius.md, padding: 10 } as const;
const inputStyle = { background: t.bg.input, border: `1px solid ${t.border.input}`, borderRadius: t.radius.sm, color: t.text.normal, padding: '4px 6px', width: '100%' } as const;

function preventWaveformContextMenu(event: MouseEvent<HTMLCanvasElement>) {
    event.preventDefault();
}

