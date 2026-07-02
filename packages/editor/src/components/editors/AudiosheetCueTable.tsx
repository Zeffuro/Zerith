import { type AudiosheetDescriptor } from '@zeffuro/zerith-core';

import { editorTheme as t } from '../../theme/editorTheme';
import { styles } from '../../theme/styleHelpers';

type AudiosheetCueTableProperties = {
    audioDuration: number;
    canPlayAudio: boolean;
    cueEntries: CueEntry[];
    onDeleteCue: (name: string) => void;
    onPlayCue: (name: string, start: number, end: number) => void;
    onRenameCue: (name: string, nextName: string) => void;
    onSeekCue: (name: string, start: number) => void;
    onSelectCue: (name: string, start: number) => void;
    onUpdateCue: (name: string, changes: Partial<AudiosheetDescriptor['cues'][string]>) => void;
    selectedCue: string | undefined;
    uiScale: number;
};

type CueEntry = [string, AudiosheetDescriptor['cues'][string]];

const panelStyle = { background: t.bg.panelAlt, border: `1px solid ${t.border.subtle}`, borderRadius: t.radius.md, padding: 10 } as const;
const inputStyle = { background: t.bg.input, border: `1px solid ${t.border.input}`, borderRadius: t.radius.sm, color: t.text.normal, padding: '4px 6px', width: '100%' } as const;

export function AudiosheetCueTable({
    audioDuration,
    canPlayAudio,
    cueEntries,
    onDeleteCue,
    onPlayCue,
    onRenameCue,
    onSeekCue,
    onSelectCue,
    onUpdateCue,
    selectedCue,
    uiScale,
}: AudiosheetCueTableProperties) {
    const buttonStyle = (disabled: boolean) => ({
        ...styles.buttonBase(uiScale),
        background: 'transparent',
        border: `1px solid ${t.border.button}`,
        color: t.text.normal,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
    });

    return (
        <section className="zerith-scrollbar" style={{ ...panelStyle, minHeight: 0, overflow: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                    <tr style={{ color: t.text.muted, textAlign: 'left' }}>
                        <th>Name</th>
                        <th>Start (s)</th>
                        <th>Duration</th>
                        <th>Loop</th>
                        <th>Volume</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {cueEntries.map(([name, cue]) => (
                        <tr key={name} onClick={() => onSelectCue(name, cue.start)} style={{ background: selectedCue === name ? t.bg.selected : 'transparent' }}>
                            <td><input defaultValue={name} onBlur={(event) => onRenameCue(name, event.target.value)} style={inputStyle} /></td>
                            <td><input onChange={(event) => onUpdateCue(name, { start: Math.max(0, Number(event.target.value) || 0) })} step={0.01} style={inputStyle} type="number" value={cue.start} /></td>
                            <td><input onChange={(event) => onUpdateCue(name, { duration: event.target.value === '' ? undefined : Math.max(0.01, Number(event.target.value) || 0.01) })} step={0.01} style={inputStyle} type="number" value={cue.duration ?? ''} /></td>
                            <td><input checked={Boolean(cue.loop)} onChange={(event) => onUpdateCue(name, { loop: event.target.checked || undefined })} type="checkbox" /></td>
                            <td><input onChange={(event) => onUpdateCue(name, { volume: event.target.value === '' ? undefined : Math.max(0, Number(event.target.value) || 0) })} step={0.05} style={inputStyle} type="number" value={cue.volume ?? ''} /></td>
                            <td style={{ display: 'flex', gap: 6 }}>
                                <button
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onSeekCue(name, cue.start);
                                    }}
                                    style={buttonStyle(false)}
                                    type="button"
                                >
                                    Seek
                                </button>
                                <button
                                    disabled={!canPlayAudio}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        const cueEnd = cue.start + (cue.duration ?? Math.max(0, audioDuration - cue.start));
                                        onPlayCue(name, cue.start, cueEnd);
                                    }}
                                    style={buttonStyle(!canPlayAudio)}
                                    type="button"
                                >
                                    Play
                                </button>
                                <button
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onDeleteCue(name);
                                    }}
                                    style={buttonStyle(false)}
                                    type="button"
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {cueEntries.length === 0 ? <div style={{ color: t.text.faint, marginTop: 8 }}>No cues. Shift+click waveform to add one.</div> : undefined}
        </section>
    );
}

