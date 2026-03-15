import { type AudiosheetDescriptor } from 'core';
import { type MouseEvent, type MutableRefObject, useEffect, useMemo, useRef, useState } from 'react';

import type { WorkbenchTab } from '../../store/workbench/types';

import { parseAudiosheetDescriptor } from '../../../../core/src/schemas/descriptorSchemas';
import { fsDirname, fsJoin, fsReadBinaryFile, fsWriteTextFile } from '../../services/fs';
import { useProjectStore } from '../../store/storeBootstrap';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { formatTimestamp, validateCueOverlaps } from './audiosheetEditorModel';
import { AudioWaveformCanvas, computeWaveformPeaks } from './AudioWaveformCanvas';

const WAVEFORM_BINS = 640;
type AudiosheetEditorPanelProperties = { tab: WorkbenchTab; };

export function AudiosheetEditorPanel({ tab }: AudiosheetEditorPanelProperties) {
    const clearFileDirty = useProjectStore((state) => state.clearFileDirty);
    const updateTabContent = useWorkbenchStore((state) => state.updateTabContent);
    const latestSerialized = useRef(tab.textContent ?? '{}');
    const contextRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<AudioBufferSourceNode | null>(null);
    const frameRef = useRef<number | null>(null);
    const playStartRef = useRef(0);
    const playOffsetRef = useRef(0);
    const playEndRef = useRef<number | null>(null);

    const [descriptor, setDescriptor] = useState<AudiosheetDescriptor>();
    const [root, setRoot] = useState<Record<string, unknown>>({});
    const [descriptorError, setDescriptorError] = useState<string>();
    const [saveError, setSaveError] = useState<string>();
    const [isSaving, setIsSaving] = useState(false);
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer>();
    const [audioPath, setAudioPath] = useState<string>();
    const [audioError, setAudioError] = useState<string>();
    const [peaks, setPeaks] = useState<number[]>([]);
    const [scrub, setScrub] = useState(0);
    const [selectedCue, setSelectedCue] = useState<string>();
    const [selectionAnchor, setSelectionAnchor] = useState<number>();
    const [isPlaying, setIsPlaying] = useState(false);

    const cueEntries = useMemo(() => Object.entries(descriptor?.cues ?? {}).toSorted((a, b) => a[1].start - b[1].start), [descriptor?.cues]);
    const cueMarkers = useMemo(() => cueEntries.map(([name, cue]) => ({ name, start: cue.start })), [cueEntries]);
    const overlapIssues = useMemo(() => validateCueOverlaps(descriptor?.cues ?? {}), [descriptor?.cues]);

    const stopPlayback = () => {
        if (sourceRef.current) {
            try {
                sourceRef.current.stop();
            } catch {
                // Ignore stop() on already-ended nodes.
            }
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        playEndRef.current = null;
        setIsPlaying(false);
    };

    const applyDescriptorUpdate = (next: AudiosheetDescriptor) => {
        setDescriptor(next);
        const nextRoot = { ...root, ...next };
        const nextText = `${JSON.stringify(nextRoot, undefined, 4)}\n`;
        latestSerialized.current = nextText;
        setRoot(nextRoot);
        updateTabContent(tab.id, nextText);
    };

    useEffect(() => {
        const rawText = tab.textContent ?? '{}';
        latestSerialized.current = rawText;
        setDescriptor(undefined);
        setDescriptorError(undefined);
        setSaveError(undefined);
        setSelectionAnchor(undefined);
        setSelectedCue(undefined);
        setScrub(0);

        let parsed: unknown = {};
        try {
            parsed = JSON.parse(rawText);
        } catch {
            setRoot({});
            setDescriptorError('Descriptor JSON is invalid.');
            return;
        }
        const result = parseAudiosheetDescriptor(parsed);
        if (!result.success) {
            setRoot(typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {});
            setDescriptorError(result.error);
            return;
        }
        setRoot(typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {});
        setDescriptor(result.data);
        setSelectedCue(Object.keys(result.data.cues)[0]);
    }, [tab.id, tab.textContent]);

    useEffect(() => {
        stopPlayback();
        setAudioBuffer(undefined);
        setAudioPath(undefined);
        setAudioError(undefined);
        setPeaks([]);
        if (!descriptor) return;
        let canceled = false;

        (async () => {
            try {
                const sourcePath = await resolveAudioPath(tab.path, descriptor.source);
                const bytes = await loadAudioBytes(sourcePath);
                const decoded = await getAudioContext(contextRef).decodeAudioData(bytes);
                if (canceled) return;
                setAudioPath(sourcePath);
                setAudioBuffer(decoded);
                setPeaks(computeWaveformPeaks(decoded.getChannelData(0), WAVEFORM_BINS));
            } catch (error) {
                if (!canceled) setAudioError(error instanceof Error ? error.message : 'Failed to decode source audio.');
            }
        })();

        return () => {
            canceled = true;
        };
    }, [descriptor, tab.path]);

    useEffect(() => () => {
        stopPlayback();
        if (contextRef.current) {
            void contextRef.current.close();
            contextRef.current = null;
        }
    }, []);

    const play = async (from: number, to?: number) => {
        if (!audioBuffer) return;
        const context = getAudioContext(contextRef);
        if (context.state === 'suspended') await context.resume();

        stopPlayback();
        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(context.destination);
        sourceRef.current = source;
        playStartRef.current = context.currentTime;
        playOffsetRef.current = clamp(from, 0, audioBuffer.duration);
        playEndRef.current = to ?? null;

        source.onended = () => {
            const endedAt = playEndRef.current;
            stopPlayback();
            if (endedAt !== null) setScrub(endedAt);
        };

        const clipDuration = to === undefined ? undefined : Math.max(0, to - playOffsetRef.current);
        source.start(0, playOffsetRef.current, clipDuration);
        setIsPlaying(true);

        const sync = () => {
            if (!sourceRef.current) return;
            const elapsed = context.currentTime - playStartRef.current;
            const next = playOffsetRef.current + elapsed;
            setScrub(playEndRef.current === null ? next : Math.min(next, playEndRef.current));
            frameRef.current = requestAnimationFrame(sync);
        };
        frameRef.current = requestAnimationFrame(sync);
    };

    const pause = () => {
        if (isPlaying && contextRef.current && audioBuffer) {
            const elapsed = contextRef.current.currentTime - playStartRef.current;
            setScrub(clamp(playOffsetRef.current + elapsed, 0, audioBuffer.duration));
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
        if (descriptor.cues[nextName]) return void globalThis.alert(`Cue "${nextName}" already exists.`);
        const cues = Object.fromEntries(Object.entries(descriptor.cues).map(([key, cue]) => [key === name ? nextName : key, cue]));
        applyDescriptorUpdate({ ...descriptor, cues });
        setSelectedCue((current) => (current === name ? nextName : current));
    };

    const addCueFromSelection = (a: number, b: number) => {
        if (!descriptor) return;
        const start = Math.max(0, Math.min(a, b));
        const duration = Math.max(0.01, Math.abs(a - b));
        const prompted = globalThis.prompt('Cue name', `cue_${Object.keys(descriptor.cues).length + 1}`);
        const name = prompted?.trim();
        if (!name) return;
        if (descriptor.cues[name]) return void globalThis.alert(`Cue "${name}" already exists.`);
        applyDescriptorUpdate({ ...descriptor, cues: { ...descriptor.cues, [name]: { duration, start, volume: 1 } } });
        setSelectedCue(name);
        setScrub(start);
    };

    const onWaveformClick = (event: MouseEvent<HTMLCanvasElement>) => {
        const duration = audioBuffer?.duration;
        if (!duration) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const clicked = clamp((event.clientX - bounds.left) / Math.max(bounds.width, 1), 0, 1) * duration;
        if (!event.shiftKey) return void setScrub(clicked);
        if (selectionAnchor === undefined) return void setSelectionAnchor(clicked);
        addCueFromSelection(selectionAnchor, clicked);
        setSelectionAnchor(undefined);
    };

    const selectedCueData = selectedCue ? descriptor?.cues[selectedCue] : undefined;
    const selectedCueEnd = !selectedCueData ? 0 : selectedCueData.start + (selectedCueData.duration ?? Math.max(0, (audioBuffer?.duration ?? selectedCueData.start) - selectedCueData.start));
    const format = descriptor?.source.split('.').pop()?.toUpperCase() ?? 'unknown';

    return (
        <div style={{ display: 'grid', gap: 12, gridTemplateRows: 'auto auto 1fr', height: '100%', padding: 12 }}>
            <div style={{ alignItems: 'center', display: 'flex', gap: 8 }}>
                <strong style={{ color: t.text.primary, marginRight: 'auto' }}>Audiosheet Editor</strong>
                <button disabled={!audioBuffer || isPlaying} onClick={() => void play(scrub)} type="button">Play</button>
                <button disabled={!audioBuffer || !isPlaying} onClick={pause} type="button">Pause</button>
                <button disabled={!audioBuffer} onClick={() => { stopPlayback(); setScrub(0); }} type="button">Stop</button>
                <button disabled={!audioBuffer || !selectedCueData} onClick={() => void play(selectedCueData?.start ?? 0, selectedCueEnd)} type="button">Play Cue</button>
                <button disabled={!descriptor || isSaving} onClick={() => void handleSave()} type="button">{isSaving ? 'Saving...' : 'Save'}</button>
            </div>

            <section style={panelStyle}>
                <div style={{ color: t.text.muted, marginBottom: 6 }}>Click waveform to scrub. Shift+click twice to create cue range.</div>
                <AudioWaveformCanvas cues={cueMarkers} durationSeconds={audioBuffer?.duration ?? 0} onClick={onWaveformClick} peaks={peaks} scrubSeconds={scrub} selectedCue={selectedCue} selectionAnchor={selectionAnchor} />
                <div style={{ color: t.text.muted, display: 'grid', gap: 4, gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', marginTop: 8 }}>
                    <span>Scrub: {formatTimestamp(scrub)}</span><span>Duration: {formatTimestamp(audioBuffer?.duration ?? 0)}</span>
                    <span>Rate: {audioBuffer?.sampleRate ? `${audioBuffer.sampleRate} Hz` : 'n/a'}</span><span>Channels: {audioBuffer?.numberOfChannels ?? 0}</span><span>Format: {format}</span>
                </div>
                {audioPath ? <div style={{ color: t.text.faint, marginTop: 6 }}>{audioPath}</div> : null}
                {overlapIssues.length > 0 ? <div style={{ color: '#fbbf24', marginTop: 6 }}>Overlap warning: {overlapIssues.length} cue range(s) overlap.</div> : null}
            </section>

            <section className="zerith-scrollbar" style={{ ...panelStyle, minHeight: 0, overflow: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead><tr style={{ color: t.text.muted, textAlign: 'left' }}><th>Name</th><th>Start (s)</th><th>Duration</th><th>Loop</th><th>Volume</th></tr></thead>
                    <tbody>{cueEntries.map(([name, cue]) => (
                        <tr key={name} onClick={() => { setSelectedCue(name); setScrub(cue.start); }} style={{ background: selectedCue === name ? t.bg.selected : 'transparent' }}>
                            <td><input defaultValue={name} onBlur={(event) => renameCue(name, event.target.value)} style={inputStyle} /></td>
                            <td><input onChange={(event) => updateCue(name, { start: Math.max(0, Number(event.target.value) || 0) })} step={0.01} style={inputStyle} type="number" value={cue.start} /></td>
                            <td><input onChange={(event) => updateCue(name, { duration: event.target.value === '' ? undefined : Math.max(0.01, Number(event.target.value) || 0.01) })} step={0.01} style={inputStyle} type="number" value={cue.duration ?? ''} /></td>
                            <td><input checked={Boolean(cue.loop)} onChange={(event) => updateCue(name, { loop: event.target.checked || undefined })} type="checkbox" /></td>
                            <td><input onChange={(event) => updateCue(name, { volume: event.target.value === '' ? undefined : Math.max(0, Number(event.target.value) || 0) })} step={0.05} style={inputStyle} type="number" value={cue.volume ?? ''} /></td>
                        </tr>
                    ))}</tbody>
                </table>
                {cueEntries.length === 0 ? <div style={{ color: t.text.faint, marginTop: 8 }}>No cues. Shift+click waveform to add one.</div> : null}
            </section>

            {(descriptorError || audioError || saveError || selectionAnchor !== undefined) ? (
                <div style={{ color: t.text.muted }}>
                    {descriptorError ? `Descriptor error: ${descriptorError}` : null}{audioError ? ` Audio error: ${audioError}` : null}{saveError ? ` Save error: ${saveError}` : null}
                    {selectionAnchor !== undefined ? ` Selection start: ${formatTimestamp(selectionAnchor)} (Shift+click again to set cue end)` : null}
                </div>
            ) : null}
        </div>
    );
}

function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
function getAudioContext(reference: MutableRefObject<AudioContext | null>): AudioContext { if (!reference.current) reference.current = new AudioContext(); return reference.current; }
async function resolveAudioPath(descriptorPath: string, source: string): Promise<string> {
    if (/^(?:https?:|data:|blob:|file:)/.test(source)) return source;
    if (/^[A-Za-z]:[\\/]/.test(source) || source.startsWith('/')) return source;
    const parent = await fsDirname(descriptorPath);
    return fsJoin(parent, source);
}
async function loadAudioBytes(path: string): Promise<ArrayBuffer> {
    if (/^(?:https?:|data:|blob:|file:)/.test(path)) return (await fetch(path)).arrayBuffer();
    const bytes = await fsReadBinaryFile(path);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

const panelStyle = { background: t.bg.panelAlt, border: `1px solid ${t.border.subtle}`, borderRadius: t.radius.md, padding: 10 } as const;
const inputStyle = { background: t.bg.input, border: `1px solid ${t.border.input}`, borderRadius: t.radius.sm, color: t.text.normal, padding: '4px 6px', width: '100%' } as const;

