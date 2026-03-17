import { type MouseEvent, type PointerEvent, type WheelEvent } from 'react';

import { editorTheme as t } from '../../theme/editorTheme';
import { styles } from '../../theme/styleHelpers';
import { formatTimestamp } from './audiosheetEditorModel';
import { type ActiveWaveformHandle, AudioWaveformCanvas, type WaveformCueMarker } from './AudioWaveformCanvas';

type AudiosheetTransportBarProperties = {
    activeHandle: ActiveWaveformHandle | undefined;
    audioPath: string | undefined;
    channels: number;
    format: string;
    onWaveformClick: (event: MouseEvent<HTMLCanvasElement>) => void;
    onWaveformContextMenu: (event: MouseEvent<HTMLCanvasElement>) => void;
    onWaveformPointerDown: (event: PointerEvent<HTMLCanvasElement>) => void;
    onWaveformPointerMove: (event: PointerEvent<HTMLCanvasElement>) => void;
    onWaveformPointerUp: (event: PointerEvent<HTMLCanvasElement>) => void;
    onWaveformWheel: (event: WheelEvent<HTMLCanvasElement>) => void;
    onWaveformZoom: (nextZoom: number) => void;
    overlapIssueCount: number;
    peaks: number[];
    projectedScrub: number;
    sampleRate: number | undefined;
    scrub: number;
    selectedCue: string | undefined;
    selectionAnchor: number | undefined;
    totalDuration: number;
    uiScale: number;
    viewportDuration: number;
    waveformMarkers: WaveformCueMarker[];
    waveformZoom: number;
};

const panelStyle = { background: t.bg.panelAlt, border: `1px solid ${t.border.subtle}`, borderRadius: t.radius.md, padding: 10 } as const;

export function AudiosheetTransportBar({
    activeHandle,
    audioPath,
    channels,
    format,
    onWaveformClick,
    onWaveformContextMenu,
    onWaveformPointerDown,
    onWaveformPointerMove,
    onWaveformPointerUp,
    onWaveformWheel,
    onWaveformZoom,
    overlapIssueCount,
    peaks,
    projectedScrub,
    sampleRate,
    scrub,
    selectedCue,
    selectionAnchor,
    totalDuration,
    uiScale,
    viewportDuration,
    waveformMarkers,
    waveformZoom,
}: AudiosheetTransportBarProperties) {
    const iconButtonStyle = (disabled: boolean) => ({
        ...styles.iconButton(uiScale),
        border: `1px solid ${t.border.button}`,
        borderRadius: t.radius.sm,
        color: t.text.normal,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
    });

    return (
        <section style={panelStyle}>
            <div style={{ alignItems: 'center', color: t.text.muted, display: 'flex', gap: 8, marginBottom: 6 }}>
                <span>Wheel to zoom, right-drag to pan view, left-drag to scrub. Drag cue handles to retime. Shift+click creates ranges. Q/E nudge nearest left/right boundary.</span>
                <span style={{ marginLeft: 'auto' }}>Zoom</span>
                <button onClick={() => onWaveformZoom(waveformZoom / 1.5)} style={iconButtonStyle(false)} type="button">-</button>
                <input max={16} min={1} onChange={(event) => onWaveformZoom(Number(event.target.value) || 1)} step={0.25} style={{ width: 120 }} type="range" value={waveformZoom} />
                <button onClick={() => onWaveformZoom(waveformZoom * 1.5)} style={iconButtonStyle(false)} type="button">+</button>
                <span>{waveformZoom.toFixed(2)}x</span>
            </div>
            <AudioWaveformCanvas
                activeHandle={activeHandle}
                cues={waveformMarkers}
                durationSeconds={viewportDuration}
                onClick={onWaveformClick}
                onContextMenu={onWaveformContextMenu}
                onPointerDown={onWaveformPointerDown}
                onPointerMove={onWaveformPointerMove}
                onPointerUp={onWaveformPointerUp}
                onWheel={onWaveformWheel}
                peaks={peaks}
                scrubSeconds={projectedScrub}
                selectedCue={selectedCue}
                selectionAnchor={selectionAnchor}
            />
            <div style={{ color: t.text.muted, display: 'grid', gap: 4, gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', marginTop: 8 }}>
                <span>Scrub: {formatTimestamp(scrub)}</span>
                <span>Duration: {formatTimestamp(totalDuration)}</span>
                <span>Rate: {sampleRate ? `${sampleRate} Hz` : 'n/a'}</span>
                <span>Channels: {channels}</span>
                <span>Format: {format}</span>
            </div>
            {audioPath ? <div style={{ color: t.text.faint, marginTop: 6 }}>{audioPath}</div> : undefined}
            {overlapIssueCount > 0 ? <div style={{ color: '#fbbf24', marginTop: 6 }}>Overlap warning: {overlapIssueCount} cue range(s) overlap.</div> : undefined}
        </section>
    );
}

