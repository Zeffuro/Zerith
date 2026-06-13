import { type AudiosheetDescriptor, parseAudiosheetDescriptor } from 'core';
import { type MouseEvent, type PointerEvent, useCallback, useEffect, useMemo, useRef, useState, type WheelEvent } from 'react';

import type { WorkbenchTab } from '../../store/workbench/types';

import { type AudiosheetShortcutAction, audiosheetShortcutEventName } from '../../services/audiosheetShortcuts';
import { fsWriteTextFile } from '../../services/fs';
import { useProjectStore } from '../../store/storeBootstrap';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { computeAudioPeaks } from '../../utils/audio';
import { clamp } from '../../utils/math';
import { ConfirmDialog } from '../ConfirmDialog';
import { createCueOperations } from './audiosheetCueCrud';
import { AudiosheetCueTable } from './AudiosheetCueTable';
import { formatTimestamp, validateCueOverlaps, waveformXToTime } from './audiosheetEditorModel';
import { AudiosheetEditorToolbar } from './AudiosheetEditorToolbar';
import { type AudiosheetPlaybackReferences, decodeAudiosheetSource, pauseAudiosheetPlayback, playAudiosheetRange, stopAudiosheetPlayback } from './audiosheetPlayback';
import { AudiosheetTransportBar } from './AudiosheetTransportBar';
import { applyZoomAtRatio, handleWaveformPointerDown, handleWaveformPointerMove, handleWaveformPointerUp, handleWaveformWheel, type WaveformDragState } from './audiosheetWaveformInteraction';
import { type ActiveWaveformHandle } from './AudioWaveformCanvas';

const WAVEFORM_BINS = 640;
type AudiosheetEditorPanelProperties = { tab: WorkbenchTab };

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

    const playbackReferences = useMemo<AudiosheetPlaybackReferences>(() => ({ contextReference, frameReference, playEndReference, playOffsetReference, playStartReference, sourceReference }), []);
    const waveformReferences = useMemo(() => ({ dragHandleReference, dragStateReference, pointerDownXReference, resumeAfterScrubReference, suppressClickReference, waveformCursorSecondsReference }), []);

    const cueEntries = useMemo(() => Object.entries(descriptor?.cues ?? {}).toSorted((a, b) => a[1].start - b[1].start), [descriptor?.cues]);
    const cueMarkers = useMemo(() => cueEntries.map(([name, cue]) => {
        const start = Math.max(0, cue.start);
        const fallbackEnd = audioBuffer?.duration ?? start + 0.01;
        const duration = cue.duration === undefined ? Math.max(0.01, fallbackEnd - start) : Math.max(0.01, cue.duration);
        return { end: start + duration, name, start };
    }), [audioBuffer?.duration, cueEntries]);
    const overlapIssues = useMemo(() => validateCueOverlaps(descriptor?.cues ?? {}), [descriptor?.cues]);

    const totalDuration = audioBuffer?.duration ?? 0;
    const visibleDuration = totalDuration <= 0 ? 0 : clamp(totalDuration / waveformZoom, 0.1, totalDuration);
    const maxViewportStart = Math.max(0, totalDuration - visibleDuration);
    const waveformViewport = { duration: visibleDuration, start: clamp(waveformViewportStart, 0, maxViewportStart) };
    const projectedWaveformMarkers = useMemo(() => {
        if (waveformViewport.duration <= 0) return [];
        const viewportStart = waveformViewport.start;
        const viewportEnd = waveformViewport.start + waveformViewport.duration;
        return cueMarkers.filter((cue) => cue.end >= viewportStart && cue.start <= viewportEnd).map((cue) => ({
            end: clamp(cue.end - viewportStart, 0, waveformViewport.duration),
            name: cue.name,
            start: clamp(cue.start - viewportStart, 0, waveformViewport.duration),
        }));
    }, [cueMarkers, waveformViewport.duration, waveformViewport.start]);
    const projectedScrub = clamp(scrub - waveformViewport.start, 0, waveformViewport.duration);
    const projectedSelectionAnchor = selectionAnchor === undefined ? undefined : clamp(selectionAnchor - waveformViewport.start, 0, waveformViewport.duration);

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
        return computeAudioPeaks(channelData.subarray(safeStartIndex, safeEndIndex), WAVEFORM_BINS);
    }, [audioBuffer, waveformViewport.duration, waveformViewport.start]);

    useEffect(() => setWaveformViewportStart((current) => clamp(current, 0, maxViewportStart)), [maxViewportStart]);

    const stopPlayback = useCallback(() => stopAudiosheetPlayback(playbackReferences, { setIsPlaying, setScrub }), [playbackReferences]);
    const play = useCallback(async (from: number, to?: number) => {
        if (!audioBuffer) return;
        await playAudiosheetRange(audioBuffer, from, to, playbackReferences, { setIsPlaying, setScrub });
    }, [audioBuffer, playbackReferences]);
    const pause = useCallback(() => pauseAudiosheetPlayback(isPlaying, audioBuffer, playbackReferences, { setIsPlaying, setScrub }), [audioBuffer, isPlaying, playbackReferences]);

    const applyDescriptorUpdate = useCallback((next: AudiosheetDescriptor) => {
        setDescriptor(next);
        const nextRoot = { ...root, ...next };
        const nextText = `${JSON.stringify(nextRoot, undefined, 4)}\n`;
        latestSerialized.current = nextText;
        skipNextLocalSyncReference.current = true;
        setRoot(nextRoot);
        updateTabContent(tab.id, nextText);
    }, [root, tab.id, updateTabContent]);

    useEffect(() => {
        const rawText = tab.textContent ?? '{}';
        if (skipNextLocalSyncReference.current && rawText === latestSerialized.current) return void (skipNextLocalSyncReference.current = false);
        latestSerialized.current = rawText;
        setDescriptor(undefined); setDescriptorError(undefined); setSaveError(undefined); setSelectionAnchor(undefined); setSelectedCue(undefined); setScrub(0);
        let parsed: unknown;
        try { parsed = JSON.parse(rawText); } catch { setRoot({}); setDescriptorError('Descriptor JSON is invalid.'); return; }
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

    useEffect(() => {
        stopPlayback();
        setAudioBuffer(undefined); setAudioPath(undefined); setAudioError(undefined);
        if (!descriptor?.source) return;
        let canceled = false;
        void (async () => {
            try {
                const { audioBuffer: decoded, sourcePath } = await decodeAudiosheetSource(tab.path, descriptor.source, playbackReferences);
                if (canceled) return;
                setAudioPath(sourcePath); setAudioBuffer(decoded);
            } catch (error) {
                if (!canceled) setAudioError(error instanceof Error ? error.message : 'Failed to decode source audio.');
            }
        })();
        return () => { canceled = true; };
    }, [descriptor?.source, playbackReferences, stopPlayback, tab.path]);

    useEffect(() => () => {
        stopPlayback();
        if (contextReference.current) { void contextReference.current.close(); contextReference.current = undefined; }
    }, [stopPlayback]);

    const handleSave = async () => {
        if (!descriptor) return;
        setIsSaving(true); setSaveError(undefined);
        try {
            await fsWriteTextFile(tab.path, latestSerialized.current);
            updateTabContent(tab.id, latestSerialized.current, { markDirty: false });
            clearFileDirty(tab.path);
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'Failed to save descriptor.');
        } finally { setIsSaving(false); }
    };

    const updateCue = useCallback((name: string, changes: Partial<AudiosheetDescriptor['cues'][string]>) => {
        if (!descriptor?.cues[name]) return;
        applyDescriptorUpdate({ ...descriptor, cues: { ...descriptor.cues, [name]: { ...descriptor.cues[name], ...changes } } });
    }, [applyDescriptorUpdate, descriptor]);

    const { addCueFromSelection, applyBoundaryShortcut, deleteCue, renameCue } = useMemo(() => createCueOperations({
        applyDescriptorUpdate,
        audioDuration: audioBuffer?.duration,
        cueMarkers,
        descriptor,
        selectedCue,
        setScrub,
        setSelectedCue,
        setValidationMessage,
        updateCue,
    }), [applyDescriptorUpdate, audioBuffer?.duration, cueMarkers, descriptor, selectedCue, updateCue]);

    const waveformState = {
        audioDuration: audioBuffer?.duration,
        descriptorCues: descriptor?.cues,
        isPlaying,
        maxViewportStart,
        projectedWaveformMarkers,
        scrub,
        waveformViewportDuration: waveformViewport.duration,
        waveformViewportStart: waveformViewport.start,
    };
    const waveformActions = { onPause: pause, onPlay: play, setActiveHandle, setScrub, setSelectedCue, setWaveformViewportStart, setWaveformZoom, updateCue };

    const onWaveformWheel = (event: WheelEvent<HTMLCanvasElement>) => handleWaveformWheel(event, totalDuration, waveformZoom, waveformViewport.duration, waveformViewport.start, waveformReferences, setWaveformZoom, setWaveformViewportStart, waveformXToTime);
    const onWaveformClick = (event: MouseEvent<HTMLCanvasElement>) => {
        if (suppressClickReference.current) return void (suppressClickReference.current = false);
        if (!audioBuffer?.duration) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const clicked = waveformXToTime(event.clientX - bounds.left, waveformViewport.duration, Math.max(bounds.width, 1)) + waveformViewport.start;
        waveformCursorSecondsReference.current = clicked;
        if (!event.shiftKey) return void setScrub(clicked);
        if (selectionAnchor === undefined) return void setSelectionAnchor(clicked);
        addCueFromSelection(selectionAnchor, clicked);
        setSelectionAnchor(undefined);
    };
    const onWaveformPointerDown = (event: PointerEvent<HTMLCanvasElement>) => handleWaveformPointerDown(event, waveformState, waveformReferences, waveformActions, waveformXToTime);
    const onWaveformPointerMove = (event: PointerEvent<HTMLCanvasElement>) => handleWaveformPointerMove(event, waveformState, waveformReferences, waveformActions, waveformXToTime);
    const onWaveformPointerUp = (event: PointerEvent<HTMLCanvasElement>) => handleWaveformPointerUp(event, waveformState, waveformReferences, waveformActions, waveformXToTime);

    useEffect(() => {
        const handleAudiosheetShortcut = (action: AudiosheetShortcutAction) => {
            const targetTime = audiosheetShortcutTargetMode === 'playhead'
                ? clamp(scrub, 0, Math.max(0, totalDuration))
                : clamp(waveformCursorSecondsReference.current ?? scrub, 0, Math.max(0, totalDuration));

            if (action === 'togglePlayPause') {
                if (!audioBuffer) return;
                if (isPlaying) pause(); else void play(scrub);
                return;
            }
            if (action === 'setLeftBoundary') {
                setSelectionAnchor(undefined);
                applyBoundaryShortcut('left', targetTime);
                return;
            }
            if (action === 'setRightBoundary') {
                setSelectionAnchor(undefined);
                applyBoundaryShortcut('right', targetTime);
                return;
            }
            if (selectedCue) deleteCue(selectedCue);
        };
        const onShortcut = (event: Event) => handleAudiosheetShortcut((event as CustomEvent<{ action: AudiosheetShortcutAction }>).detail.action);
        globalThis.addEventListener(audiosheetShortcutEventName, onShortcut);
        return () => globalThis.removeEventListener(audiosheetShortcutEventName, onShortcut);
    }, [applyBoundaryShortcut, audioBuffer, audiosheetShortcutTargetMode, deleteCue, isPlaying, pause, play, scrub, selectedCue, totalDuration, waveformCursorSecondsReference]);

    const selectedCueData = selectedCue ? descriptor?.cues[selectedCue] : undefined;
    const selectedCueEnd = selectedCueData ? selectedCueData.start + (selectedCueData.duration ?? Math.max(0, (audioBuffer?.duration ?? selectedCueData.start) - selectedCueData.start)) : 0;
    const format = descriptor?.source.split('.').pop()?.toUpperCase() ?? 'unknown';

    return (
        <div style={{ display: 'grid', gap: 12, gridTemplateRows: 'auto auto 1fr', height: '100%', padding: 12 }}>
            <AudiosheetEditorToolbar
                canDeleteCue={Boolean(selectedCueData)}
                canPause={Boolean(audioBuffer && isPlaying)}
                canPlay={Boolean(audioBuffer && !isPlaying)}
                canPlayCue={Boolean(audioBuffer && selectedCueData)}
                canSave={Boolean(descriptor)}
                isSaving={isSaving}
                onDeleteCue={() => { if (selectedCue) deleteCue(selectedCue); }}
                onPause={pause}
                onPlay={() => void play(scrub)}
                onPlayCue={() => void play(selectedCueData?.start ?? 0, selectedCueEnd)}
                onSave={() => void handleSave()}
                onStop={() => { stopPlayback(); setScrub(0); }}
                uiScale={uiScale}
            />
            <AudiosheetTransportBar
                activeHandle={activeHandle}
                audioPath={audioPath}
                channels={audioBuffer?.numberOfChannels ?? 0}
                format={format}
                onWaveformClick={onWaveformClick}
                onWaveformContextMenu={preventWaveformContextMenu}
                onWaveformPointerDown={onWaveformPointerDown}
                onWaveformPointerMove={onWaveformPointerMove}
                onWaveformPointerUp={onWaveformPointerUp}
                onWaveformWheel={onWaveformWheel}
                onWaveformZoom={(nextZoom) => applyZoomAtRatio(nextZoom, 0.5, totalDuration, waveformZoom, waveformViewport.start, setWaveformZoom, setWaveformViewportStart)}
                overlapIssueCount={overlapIssues.length}
                peaks={projectedPeaks}
                projectedScrub={projectedScrub}
                sampleRate={audioBuffer?.sampleRate}
                scrub={scrub}
                selectedCue={selectedCue}
                selectionAnchor={projectedSelectionAnchor}
                totalDuration={audioBuffer?.duration ?? 0}
                uiScale={uiScale}
                viewportDuration={waveformViewport.duration}
                waveformMarkers={projectedWaveformMarkers}
                waveformZoom={waveformZoom}
            />
            <AudiosheetCueTable
                audioDuration={audioBuffer?.duration ?? 0}
                canPlayAudio={Boolean(audioBuffer)}
                cueEntries={cueEntries}
                onDeleteCue={deleteCue}
                onPlayCue={(_name, start, end) => { void play(start, end); }}
                onRenameCue={renameCue}
                onSeekCue={(name, start) => { setSelectedCue(name); setScrub(start); }}
                onSelectCue={(name, start) => { setSelectedCue(name); setScrub(start); }}
                onUpdateCue={updateCue}
                selectedCue={selectedCue}
                uiScale={uiScale}
            />
            {(descriptorError || audioError || saveError || selectionAnchor !== undefined) ? (
                <div style={{ color: t.text.muted }}>
                    {descriptorError ? `Descriptor error: ${descriptorError}` : undefined}
                    {audioError ? ` Audio error: ${audioError}` : undefined}
                    {saveError ? ` Save error: ${saveError}` : undefined}
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

function preventWaveformContextMenu(event: MouseEvent<HTMLCanvasElement>) { event.preventDefault(); }
