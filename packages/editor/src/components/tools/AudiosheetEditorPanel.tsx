import { convertFileSrc } from '@tauri-apps/api/core';
import { type ChangeEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';

import { useProjectStore } from '../../store/storeBootstrap';
import { useEditorStore } from '../../store/useEditorStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { AUDIO_EXT, getExtension } from '../../utils/assetTypes';

type AudioCue = {
    id: string;
    label: string;
    time: number;
};

type AudioMetadata = {
    durationSeconds: number;
    format: string;
    sampleRateHz: number | undefined;
};

const DEFAULT_METADATA: AudioMetadata = {
    durationSeconds: 0,
    format: 'unknown',
    sampleRateHz: undefined,
};

const WAVEFORM_BINS = 384;

export function AudiosheetEditorPanel() {
    const projectPath = useProjectStore((state) => state.projectPath);
    const selectedAssetPath = useEditorStore((state) => state.selectedAssetPath);
    const uiScale = useSettingsStore((state) => state.uiScale);

    const audioReference = useRef<HTMLAudioElement>(null);
    const waveformReference = useRef<HTMLCanvasElement>(null);

    const [currentTimeSeconds, setCurrentTimeSeconds] = useState(0);
    const [cues, setCues] = useState<AudioCue[]>([]);
    const [metadata, setMetadata] = useState<AudioMetadata>(DEFAULT_METADATA);
    const [selectedCueId, setSelectedCueId] = useState<string | undefined>();
    const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);

    const extension = getExtension(selectedAssetPath ?? '');
    const isSupportedAsset = Boolean(selectedAssetPath) && AUDIO_EXT.has(extension);

    const source = useMemo(() => {
        if (!selectedAssetPath) return;
        if (selectedAssetPath.startsWith('http')) return selectedAssetPath;
        if (!projectPath) return selectedAssetPath;
        return convertFileSrc(projectPath + selectedAssetPath);
    }, [projectPath, selectedAssetPath]);

    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            setCurrentTimeSeconds(0);
            setCues([]);
            setMetadata({
                ...DEFAULT_METADATA,
                format: extension ? extension.replace('.', '').toUpperCase() : 'unknown',
            });
            setSelectedCueId(undefined);
            setWaveformPeaks([]);
        });

        return () => cancelAnimationFrame(frame);
    }, [extension, source]);

    useEffect(() => {
        if (!source || !isSupportedAsset) return;

        let canceled = false;

        const loadWaveform = async () => {
            try {
                const response = await fetch(source);
                const arrayBuffer = await response.arrayBuffer();
                const context = new AudioContext();
                const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
                await context.close();

                if (canceled) return;

                const primaryChannel = decoded.getChannelData(0);
                setWaveformPeaks(computeWaveformPeaks(primaryChannel, WAVEFORM_BINS));
                setMetadata((previous) => ({ ...previous, sampleRateHz: decoded.sampleRate }));
            } catch (error) {
                console.warn('Failed to decode audio for waveform preview.', error);
            }
        };

        void loadWaveform();

        return () => {
            canceled = true;
        };
    }, [isSupportedAsset, source]);

    useEffect(() => {
        drawWaveform({
            canvas: waveformReference.current,
            cues,
            currentTimeSeconds,
            durationSeconds: metadata.durationSeconds,
            peaks: waveformPeaks,
            uiScale,
        });
    }, [cues, currentTimeSeconds, metadata.durationSeconds, uiScale, waveformPeaks]);

    const addCueAtCurrentTime = () => {
        const nextTime = clampTime(currentTimeSeconds, metadata.durationSeconds);
        setCues((previous) => {
            const nextCue: AudioCue = {
                id: `cue-${Date.now()}-${Math.trunc(Math.random() * 100_000)}`,
                label: `Cue ${previous.length + 1}`,
                time: nextTime,
            };
            return [...previous, nextCue].toSorted((a, b) => a.time - b.time);
        });
    };

    const deleteCue = (id: string) => {
        setCues((previous) => previous.filter((cue) => cue.id !== id));
        setSelectedCueId((previous) => (previous === id ? undefined : previous));
    };

    const onCueLabelChange = (cueId: string, event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setCues((previous) => previous.map((cue) => (cue.id === cueId ? { ...cue, label: value } : cue)));
    };

    const onWaveformClick = (event: MouseEvent<HTMLCanvasElement>) => {
        const canvas = waveformReference.current;
        if (!canvas || !metadata.durationSeconds) return;

        const bounds = canvas.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(bounds.width, 1)));
        const nextTime = ratio * metadata.durationSeconds;
        setCurrentTimeSeconds(nextTime);

        if (audioReference.current) {
            audioReference.current.currentTime = nextTime;
        }
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
                overflow: 'auto',
                padding: `${8 * uiScale}px`,
            }}
        >
            <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
                <strong style={{ color: t.text.primary }}>Audiosheet Editor</strong>
                <button className="toolbar-btn" onClick={addCueAtCurrentTime} type="button">
                    Add Cue @ {formatSeconds(currentTimeSeconds)}
                </button>
            </div>

            {!selectedAssetPath && <PanelHint text="Select an audio file from Explorer to inspect." />}

            {!!selectedAssetPath && !isSupportedAsset && (
                <PanelHint text={`Unsupported file type for audiosheet: ${extension || '(none)'}.`} />
            )}

            {!!selectedAssetPath && isSupportedAsset && !!source && (
                <>
                    <audio
                        controls
                        onLoadedMetadata={(event) => {
                            const durationSeconds = Number.isFinite(event.currentTarget.duration)
                                ? event.currentTarget.duration
                                : 0;
                            setMetadata((previous) => ({ ...previous, durationSeconds }));
                        }}
                        onTimeUpdate={(event) => setCurrentTimeSeconds(event.currentTarget.currentTime)}
                        ref={audioReference}
                        src={source}
                        style={{ width: '100%' }}
                    />

                    <div
                        style={{
                            background: t.bg.panelAlt,
                            border: `1px solid ${t.border.subtle}`,
                            borderRadius: t.radius.md,
                            display: 'grid',
                            gap: `${8 * uiScale}px`,
                            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                            padding: `${8 * uiScale}px`,
                        }}
                    >
                        <MetadataValue label="Duration" value={formatSeconds(metadata.durationSeconds)} />
                        <MetadataValue label="Format" value={metadata.format} />
                        <MetadataValue
                            label="Sample rate"
                            value={metadata.sampleRateHz ? `${metadata.sampleRateHz.toLocaleString()} Hz` : 'Unavailable'}
                        />
                    </div>

                    <div
                        style={{
                            background: t.bg.panelAlt,
                            border: `1px solid ${t.border.subtle}`,
                            borderRadius: t.radius.md,
                            minHeight: `${164 * uiScale}px`,
                            padding: `${8 * uiScale}px`,
                        }}
                    >
                        <div style={{ color: t.text.muted, marginBottom: `${6 * uiScale}px` }}>
                            Waveform (click to seek)
                        </div>
                        <canvas
                            onClick={onWaveformClick}
                            ref={waveformReference}
                            style={{ cursor: 'pointer', display: 'block', height: `${132 * uiScale}px`, width: '100%' }}
                        />
                    </div>

                    <div
                        className="zerith-scrollbar"
                        style={{
                            background: t.bg.panelAlt,
                            border: `1px solid ${t.border.subtle}`,
                            borderRadius: t.radius.md,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: `${6 * uiScale}px`,
                            maxHeight: `${220 * uiScale}px`,
                            overflow: 'auto',
                            padding: `${8 * uiScale}px`,
                        }}
                    >
                        <strong style={{ color: t.text.primary }}>Cue Points</strong>
                        {cues.length === 0 && (
                            <div style={{ color: t.text.faint, fontStyle: 'italic' }}>
                                No cues yet. Play audio and press "Add Cue".
                            </div>
                        )}
                        {cues.map((cue) => (
                            <div
                                key={cue.id}
                                style={{
                                    alignItems: 'center',
                                    background: selectedCueId === cue.id ? t.bg.selected : 'transparent',
                                    borderRadius: t.radius.sm,
                                    display: 'grid',
                                    gap: `${6 * uiScale}px`,
                                    gridTemplateColumns: '98px minmax(0, 1fr) auto auto',
                                    padding: `${4 * uiScale}px`,
                                }}
                            >
                                <code>{formatSeconds(cue.time)}</code>
                                <input
                                    onChange={(event) => onCueLabelChange(cue.id, event)}
                                    onFocus={() => setSelectedCueId(cue.id)}
                                    style={{
                                        background: t.bg.input,
                                        border: `1px solid ${t.border.input}`,
                                        borderRadius: t.radius.sm,
                                        color: t.text.primary,
                                        padding: `${4 * uiScale}px ${6 * uiScale}px`,
                                    }}
                                    type="text"
                                    value={cue.label}
                                />
                                <button
                                    className="toolbar-btn"
                                    onClick={() => {
                                        setSelectedCueId(cue.id);
                                        setCurrentTimeSeconds(cue.time);
                                        if (audioReference.current) audioReference.current.currentTime = cue.time;
                                    }}
                                    type="button"
                                >
                                    Jump
                                </button>
                                <button className="toolbar-btn" onClick={() => deleteCue(cue.id)} type="button">
                                    Delete
                                </button>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function clampTime(time: number, duration: number): number {
    if (!Number.isFinite(time) || time < 0) return 0;
    if (!Number.isFinite(duration) || duration <= 0) return time;
    return Math.min(time, duration);
}
function computeWaveformPeaks(channelData: Float32Array, bins: number): number[] {
    if (channelData.length === 0 || bins <= 0) return [];
    const peaks = Array.from({ length: bins }, () => 0);
    const samplesPerBin = Math.max(1, Math.floor(channelData.length / bins));
    for (let index = 0; index < bins; index += 1) {
        const start = index * samplesPerBin;
        const end = index === bins - 1 ? channelData.length : start + samplesPerBin;
        let max = 0;
        for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
            const amplitude = Math.abs(channelData[sampleIndex] ?? 0);
            if (amplitude > max) max = amplitude;
        }
        peaks[index] = max;
    }
    const maxPeak = Math.max(...peaks, 0.0001);
    return peaks.map((peak) => peak / maxPeak);
}
function drawWaveform(properties: {
    canvas: HTMLCanvasElement | null;
    cues: AudioCue[];
    currentTimeSeconds: number;
    durationSeconds: number;
    peaks: number[];
    uiScale: number;
}): void {
    const { canvas, cues, currentTimeSeconds, durationSeconds, peaks, uiScale } = properties;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const devicePixelRatio = globalThis.devicePixelRatio || 1;
    const clientWidth = Math.max(320, Math.floor(canvas.clientWidth));
    const clientHeight = Math.max(80, Math.floor(132 * uiScale));
    canvas.width = Math.floor(clientWidth * devicePixelRatio);
    canvas.height = Math.floor(clientHeight * devicePixelRatio);
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.clearRect(0, 0, clientWidth, clientHeight);
    context.fillStyle = '#0f1117';
    context.fillRect(0, 0, clientWidth, clientHeight);
    const centerY = clientHeight / 2;
    const barWidth = clientWidth / Math.max(peaks.length, 1);
    context.fillStyle = '#6ea8ff';
    for (const [index, peak] of peaks.entries()) {
        const amplitude = peak * (clientHeight * 0.45);
        const x = index * barWidth;
        context.fillRect(x, centerY - amplitude, Math.max(1, barWidth - 0.5), amplitude * 2);
    }
    if (durationSeconds > 0) {
        context.strokeStyle = '#fbbf24';
        context.lineWidth = 2;
        const playheadX = (currentTimeSeconds / durationSeconds) * clientWidth;
        context.beginPath();
        context.moveTo(playheadX, 0);
        context.lineTo(playheadX, clientHeight);
        context.stroke();

        context.strokeStyle = '#22c55e';
        context.lineWidth = 1;
        for (const cue of cues) {
            const cueX = (cue.time / durationSeconds) * clientWidth;
            context.beginPath();
            context.moveTo(cueX, 0);
            context.lineTo(cueX, clientHeight);
            context.stroke();
        }
    }
}
function formatSeconds(value: number): string {
    if (!Number.isFinite(value) || value < 0) return '00:00.000';
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    const milliseconds = Math.floor((value % 1) * 1000);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}
function MetadataValue({ label, value }: { label: string; value: string; }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><span style={{ color: t.text.faint }}>{label}</span><span style={{ color: t.text.primary }}>{value}</span></div>
    );
}
function PanelHint({ text }: { text: string; }) {
    return (
        <div style={{ background: t.bg.panelAlt, border: `1px solid ${t.border.subtle}`, borderRadius: t.radius.md, color: t.text.faint, padding: '12px' }}>
            {text}
        </div>
    );
}

