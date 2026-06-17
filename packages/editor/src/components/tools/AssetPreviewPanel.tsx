import { Pause, Play } from 'lucide-react';
import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react';

import { useAssetOptions } from '../../hooks/useAssetOptions';
import { releaseEditorAssetUrl, resolveEditorAssetUrl } from '../../services/runtime/assetUrls';
import { useProjectStore } from '../../store/storeBootstrap';
import { useEditorStore } from '../../store/useEditorStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { AUDIO_EXT, getExtension, IMG_EXT } from '../../utils/assetTypes';
import { closeAudioContext, computeAudioPeaks, decodeAudioSource } from '../../utils/audio';
import { formatTimestamp } from '../editors/audiosheetEditorModel';
import { AudioWaveformCanvas } from '../editors/AudioWaveformCanvas';

const WAVEFORM_BINS = 420;

export function AssetPreviewPanel({ uiScale }: { uiScale: number }) {
    const projectPath = useProjectStore((s) => s.projectPath);
    const { assets } = useAssetOptions('all');
    const selectedAssetPath = useEditorStore((s) => s.selectedAssetPath);
    const audioReference = useRef<HTMLAudioElement>(null);
    const audioContextReference = useRef<AudioContext | undefined>(undefined);
    const audioScrubDragReference = useRef(false);

    const [value, setValue] = useState('');
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer>();
    const [audioError, setAudioError] = useState<string>();
    const [audioIsPlaying, setAudioIsPlaying] = useState(false);
    const [audioLoading, setAudioLoading] = useState(false);
    const [audioScrub, setAudioScrub] = useState(0);
    const [imageSize, setImageSize] = useState<{ height: number; width: number }>();
    const [resolvedSource, setResolvedSource] = useState('');

    useEffect(() => {
        if (!selectedAssetPath) return;
        const frame = requestAnimationFrame(() => {
            setValue(selectedAssetPath);
        });
        return () => cancelAnimationFrame(frame);
    }, [selectedAssetPath]);

    const sourceForDecoding = useMemo(() => resolveAssetSource(value, projectPath), [projectPath, value]);

    const extension = getExtension(value);
    const isImg = IMG_EXT.has(extension);
    const isAudio = AUDIO_EXT.has(extension);
    const audioPeaks = useMemo(() => {
        if (!audioBuffer) return [];
        return computeAudioPeaks(audioBuffer.getChannelData(0), WAVEFORM_BINS);
    }, [audioBuffer]);

    useEffect(() => {
        setAudioBuffer(undefined);
        setAudioError(undefined);
        setAudioIsPlaying(false);
        setAudioLoading(false);
        setAudioScrub(0);
        audioReference.current?.pause();
        if (!isAudio || !sourceForDecoding) return;

        let canceled = false;
        setAudioLoading(true);
        void (async () => {
            try {
                const decoded = await decodeAudioSource(sourceForDecoding, audioContextReference);
                if (canceled) return;
                setAudioBuffer(decoded);
            } catch (error) {
                if (!canceled) setAudioError(error instanceof Error ? error.message : 'Failed to decode audio.');
            } finally {
                if (!canceled) setAudioLoading(false);
            }
        })();

        return () => {
            canceled = true;
        };
    }, [isAudio, sourceForDecoding]);

    useEffect(() => {
        setImageSize(undefined);
        setResolvedSource('');
        if (!value) {
            return;
        }

        let canceled = false;
        let resolvedUrl: string | undefined;

        void (async () => {
            try {
                resolvedUrl = await resolveEditorAssetUrl(resolveAssetSource(value, projectPath));
                if (canceled) {
                    releaseEditorAssetUrl(resolvedUrl);
                    return;
                }
                setResolvedSource(resolvedUrl);
            } catch (error) {
                if (canceled) return;
                setResolvedSource('');
                if (isAudio) {
                    setAudioError(error instanceof Error ? error.message : 'Failed to resolve audio asset.');
                }
            }
        })();

        return () => {
            canceled = true;
            if (resolvedUrl) {
                releaseEditorAssetUrl(resolvedUrl);
            }
        };
    }, [isAudio, projectPath, value]);

    useEffect(() => () => {
        void closeAudioContext(audioContextReference);
    }, []);

    const audioDuration = audioBuffer?.duration ?? audioReference.current?.duration ?? 0;
    const iconSize = Math.max(14, Math.round(15 * uiScale));

    const seekAudioFromClientX = (canvas: HTMLCanvasElement, clientX: number) => {
        const duration = audioBuffer?.duration ?? audioReference.current?.duration ?? 0;
        if (!duration) return;
        const bounds = canvas.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (clientX - bounds.left) / Math.max(1, bounds.width)));
        const nextTime = ratio * duration;
        setAudioScrub(nextTime);
        if (audioReference.current) {
            audioReference.current.currentTime = nextTime;
        }
    };

    const handleAudioPlayToggle = () => {
        const audio = audioReference.current;
        if (!audio) return;
        if (audio.paused) {
            void audio.play().catch((error: unknown) => {
                setAudioError(error instanceof Error ? error.message : 'Failed to play audio.');
            });
            return;
        }
        audio.pause();
    };

    const handleWaveformPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
        if (!audioDuration) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        audioScrubDragReference.current = true;
        seekAudioFromClientX(event.currentTarget, event.clientX);
    };

    const handleWaveformPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
        if (!audioScrubDragReference.current) return;
        event.preventDefault();
        seekAudioFromClientX(event.currentTarget, event.clientX);
    };

    const handleWaveformPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
        if (!audioScrubDragReference.current) return;
        audioScrubDragReference.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${8 * uiScale}px`, height: '100%' }}>
            <strong style={{ color: t.text.primary }}>Asset Preview</strong>

            <input
                list="asset-preview-options"
                onChange={(event) => setValue(event.target.value)}
                placeholder="/assets/..."
                style={{
                    background: t.bg.input,
                    border: `1px solid ${t.border.input}`,
                    borderRadius: t.radius.md,
                    color: t.text.primary,
                    padding: `${8 * uiScale}px`,
                    width: '100%',
                }}
                type="text"
                value={value}
            />
            <datalist id="asset-preview-options">
                {assets.slice(0, 500).map((a) => (
                    <option key={a.value} value={a.value} />
                ))}
            </datalist>

            <div
                className="zerith-scrollbar"
                style={{
                    background: t.bg.panelAlt,
                    border: `1px solid ${t.border.subtle}`,
                    borderRadius: t.radius.md,
                    flex: 1,
                    overflow: 'auto',
                    padding: `${8 * uiScale}px`,
                }}
            >
                {!value && <div style={{ color: t.text.faint }}>Pick an asset to preview.</div>}

                {!!value && isImg && !resolvedSource && (
                    <div style={{ color: t.text.muted }}>Resolving image...</div>
                )}

                {!!value && isImg && resolvedSource && (
                    <div style={{ display: 'grid', gap: `${8 * uiScale}px`, justifyItems: 'start' }}>
                        <img
                            alt={value}
                            onLoad={(event) => setImageSize({
                                height: event.currentTarget.naturalHeight,
                                width: event.currentTarget.naturalWidth,
                            })}
                            src={resolvedSource}
                            style={{ imageRendering: 'pixelated', maxHeight: '100%', maxWidth: '100%' }}
                        />
                        {imageSize ? (
                            <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                                {imageSize.width}x{imageSize.height} | {extension.slice(1).toUpperCase()}
                            </div>
                        ) : undefined}
                    </div>
                )}

                {!!value && isAudio && !resolvedSource && (
                    <div style={{ color: t.text.muted }}>Resolving audio...</div>
                )}

                {!!value && isAudio && resolvedSource && (
                    <div style={{ display: 'grid', gap: `${10 * uiScale}px` }}>
                        <audio
                            onDurationChange={(event) => setAudioScrub(Math.min(audioScrub, event.currentTarget.duration || 0))}
                            onEnded={() => setAudioIsPlaying(false)}
                            onPause={() => setAudioIsPlaying(false)}
                            onPlay={() => setAudioIsPlaying(true)}
                            onTimeUpdate={(event) => setAudioScrub(event.currentTarget.currentTime)}
                            preload="metadata"
                            ref={audioReference}
                            src={resolvedSource}
                            style={{ display: 'none' }}
                        />
                        <div style={{ alignItems: 'center', display: 'flex', gap: `${8 * uiScale}px` }}>
                            <button
                                disabled={!audioDuration}
                                onClick={handleAudioPlayToggle}
                                style={{
                                    alignItems: 'center',
                                    background: audioIsPlaying ? t.bg.panel : t.accent.primary,
                                    border: `1px solid ${audioIsPlaying ? t.border.button : t.border.primaryBtn}`,
                                    borderRadius: t.radius.sm,
                                    color: audioIsPlaying ? t.text.normal : '#fff',
                                    cursor: audioDuration ? 'pointer' : 'not-allowed',
                                    display: 'inline-flex',
                                    gap: `${6 * uiScale}px`,
                                    minHeight: `${30 * uiScale}px`,
                                    opacity: audioDuration ? 1 : 0.55,
                                    padding: `${5 * uiScale}px ${9 * uiScale}px`,
                                }}
                                type="button"
                            >
                                {audioIsPlaying ? <Pause size={iconSize} /> : <Play size={iconSize} />}
                                {audioIsPlaying ? 'Pause' : 'Play'}
                            </button>
                            <span style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                                {formatTimestamp(audioScrub)} / {formatTimestamp(audioDuration)}
                            </span>
                        </div>
                        <AudioWaveformCanvas
                            cues={[]}
                            durationSeconds={audioDuration}
                            height={120}
                            onPointerCancel={handleWaveformPointerUp}
                            onPointerDown={handleWaveformPointerDown}
                            onPointerMove={handleWaveformPointerMove}
                            onPointerUp={handleWaveformPointerUp}
                            peaks={audioPeaks}
                            scrubSeconds={audioScrub}
                            selectedCue={undefined}
                            selectionAnchor={undefined}
                        />
                        <div style={{ color: t.text.muted, display: 'grid', fontSize: `${12 * uiScale}px`, gap: `${4 * uiScale}px`, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                            <span>Time: {formatTimestamp(audioScrub)}</span>
                            <span>Duration: {formatTimestamp(audioDuration)}</span>
                            <span>Channels: {audioBuffer?.numberOfChannels ?? 'n/a'}</span>
                            <span>Rate: {audioBuffer?.sampleRate ? `${audioBuffer.sampleRate} Hz` : 'n/a'}</span>
                            <span>Format: {extension.slice(1).toUpperCase()}</span>
                            <span>{audioLoading ? 'Decoding waveform...' : 'Waveform ready'}</span>
                        </div>
                        {audioError ? <div style={{ color: t.accent.red, fontSize: `${12 * uiScale}px` }}>{audioError}</div> : undefined}
                    </div>
                )}

                {!!value && !isImg && !isAudio && (
                    <div style={{ color: t.text.muted }}>
                        No preview renderer for <code>{extension || 'unknown'}</code>.
                    </div>
                )}
            </div>
        </div>
    );
}

function resolveAssetSource(value: string, projectPath: string | undefined): string {
    if (!value) return '';
    if (/^(?:https?:|data:|blob:|file:|asset:)/.test(value)) return value;
    if (/^[A-Za-z]:[\\/]/.test(value) || value.startsWith('/')) {
        return projectPath && value.startsWith('/') ? projectPath + value : value;
    }
    return projectPath ? `${projectPath}/${value}` : value;
}
