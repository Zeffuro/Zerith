import { type PointerEvent, type WheelEvent } from 'react';

import { clamp } from '../../utils/math';
import { computeCueDragUpdate, findCueHandleHit } from './audiosheetEditorModel';
import { type ActiveWaveformHandle, type WaveformCueMarker } from './AudioWaveformCanvas';

const WAVEFORM_HANDLE_TOLERANCE_PX = 8;

export type WaveformDragState =
    | { mode: 'cue'; pointerId: number }
    | { mode: 'pan'; pointerId: number; startViewportStart: number; x: number }
    | { mode: 'scrub'; pointerId: number };

export type WaveformInteractionActions = {
    onPause: () => void;
    onPlay: (from: number) => Promise<void>;
    setActiveHandle: (next: ActiveWaveformHandle | undefined) => void;
    setScrub: (next: number) => void;
    setSelectedCue: (next: string) => void;
    setWaveformViewportStart: (next: number) => void;
    setWaveformZoom: (next: number) => void;
    updateCue: (name: string, changes: Partial<CueRecord[string]>) => void;
};

export type WaveformInteractionReferences = {
    dragHandleReference: { current: ActiveWaveformHandle | undefined };
    dragStateReference: { current: undefined | WaveformDragState };
    pointerDownXReference: { current: number };
    resumeAfterScrubReference: { current: boolean };
    suppressClickReference: { current: boolean };
    waveformCursorSecondsReference: { current: number | undefined };
};

export type WaveformInteractionState = {
    audioDuration: number | undefined;
    descriptorCues: CueRecord | undefined;
    isPlaying: boolean;
    maxViewportStart: number;
    projectedWaveformMarkers: WaveformCueMarker[];
    scrub: number;
    waveformViewportDuration: number;
    waveformViewportStart: number;
};

type CueRecord = Record<string, { duration?: number; start: number; volume?: number }>;

export function applyZoomAtRatio(
    nextZoomRaw: number,
    ratioRaw: number,
    totalDuration: number,
    waveformZoom: number,
    waveformViewportStart: number,
    setWaveformZoom: (next: number) => void,
    setWaveformViewportStart: (next: number) => void,
): void {
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
}

export function handleWaveformPointerDown(
    event: PointerEvent<HTMLCanvasElement>,
    state: WaveformInteractionState,
    references: WaveformInteractionReferences,
    actions: WaveformInteractionActions,
    waveformXToTime: (x: number, durationSeconds: number, width: number) => number,
): void {
    if (!state.audioDuration || (event.button !== 0 && event.button !== 2)) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const safeWidth = Math.max(bounds.width, 1);
    const pointerX = clamp(event.clientX - bounds.left, 0, safeWidth);
    const pointerSeconds = waveformXToTime(pointerX, state.waveformViewportDuration, safeWidth) + state.waveformViewportStart;
    references.waveformCursorSecondsReference.current = pointerSeconds;
    references.pointerDownXReference.current = pointerX;
    references.suppressClickReference.current = false;

    if (event.button === 2) {
        references.dragStateReference.current = { mode: 'pan', pointerId: event.pointerId, startViewportStart: state.waveformViewportStart, x: pointerX };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
    }

    const handleHit = findCueHandleHit(state.projectedWaveformMarkers, pointerX, state.waveformViewportDuration, safeWidth, WAVEFORM_HANDLE_TOLERANCE_PX);
    if (handleHit) {
        const nextActiveHandle: ActiveWaveformHandle = { cueName: handleHit.cueName, handle: handleHit.handle };
        references.dragHandleReference.current = nextActiveHandle;
        references.dragStateReference.current = { mode: 'cue', pointerId: event.pointerId };
        actions.setActiveHandle(nextActiveHandle);
        actions.setSelectedCue(handleHit.cueName);
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
    }

    if (event.shiftKey) return;

    references.resumeAfterScrubReference.current = false;
    if (state.isPlaying) {
        references.resumeAfterScrubReference.current = true;
        actions.onPause();
    }

    references.dragStateReference.current = { mode: 'scrub', pointerId: event.pointerId };
    actions.setScrub(pointerSeconds);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
}

export function handleWaveformPointerMove(
    event: PointerEvent<HTMLCanvasElement>,
    state: WaveformInteractionState,
    references: WaveformInteractionReferences,
    actions: WaveformInteractionActions,
    waveformXToTime: (x: number, durationSeconds: number, width: number) => number,
): void {
    if (!state.audioDuration) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const safeWidth = Math.max(bounds.width, 1);
    const pointerX = clamp(event.clientX - bounds.left, 0, safeWidth);
    const pointerSeconds = waveformXToTime(pointerX, state.waveformViewportDuration, safeWidth) + state.waveformViewportStart;
    references.waveformCursorSecondsReference.current = pointerSeconds;

    const dragState = references.dragStateReference.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    if (Math.abs(pointerX - references.pointerDownXReference.current) > 2) references.suppressClickReference.current = true;

    if (dragState.mode === 'pan') {
        const deltaSeconds = ((pointerX - dragState.x) / safeWidth) * state.waveformViewportDuration;
        actions.setWaveformViewportStart(clamp(dragState.startViewportStart - deltaSeconds, 0, state.maxViewportStart));
        return;
    }

    if (dragState.mode === 'scrub') {
        actions.setScrub(pointerSeconds);
        return;
    }

    const active = references.dragHandleReference.current;
    if (!state.descriptorCues || !active || !state.descriptorCues[active.cueName]) return;
    const cue = state.descriptorCues[active.cueName];
    actions.updateCue(active.cueName, computeCueDragUpdate(cue, active.handle, pointerSeconds, state.audioDuration));
    actions.setScrub(pointerSeconds);
}

export function handleWaveformPointerUp(
    event: PointerEvent<HTMLCanvasElement>,
    state: WaveformInteractionState,
    references: WaveformInteractionReferences,
    actions: WaveformInteractionActions,
    waveformXToTime: (x: number, durationSeconds: number, width: number) => number,
): void {
    const dragState = references.dragStateReference.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const safeWidth = Math.max(bounds.width, 1);
    const pointerX = clamp(event.clientX - bounds.left, 0, safeWidth);
    const releaseSeconds = state.audioDuration
        ? waveformXToTime(pointerX, state.waveformViewportDuration, safeWidth) + state.waveformViewportStart
        : state.scrub;
    references.waveformCursorSecondsReference.current = releaseSeconds;
    references.dragStateReference.current = undefined;
    references.dragHandleReference.current = undefined;
    actions.setActiveHandle(undefined);

    if (dragState.mode === 'pan') {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        return;
    }

    if (dragState.mode === 'scrub') {
        actions.setScrub(releaseSeconds);
        if (references.resumeAfterScrubReference.current && state.audioDuration) {
            references.resumeAfterScrubReference.current = false;
            void actions.onPlay(releaseSeconds);
        }
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
}

export function handleWaveformWheel(
    event: WheelEvent<HTMLCanvasElement>,
    totalDuration: number,
    waveformZoom: number,
    waveformViewportDuration: number,
    waveformViewportStart: number,
    references: WaveformInteractionReferences,
    setWaveformZoom: (next: number) => void,
    setWaveformViewportStart: (next: number) => void,
    waveformXToTime: (x: number, durationSeconds: number, width: number) => number,
): void {
    if (totalDuration <= 0) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = bounds.width <= 0 ? 0.5 : clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
    references.waveformCursorSecondsReference.current = waveformXToTime(event.clientX - bounds.left, waveformViewportDuration, Math.max(bounds.width, 1)) + waveformViewportStart;
    const zoomDelta = event.deltaY < 0 ? 1.15 : (1 / 1.15);
    applyZoomAtRatio(waveformZoom * zoomDelta, ratio, totalDuration, waveformZoom, waveformViewportStart, setWaveformZoom, setWaveformViewportStart);
}


