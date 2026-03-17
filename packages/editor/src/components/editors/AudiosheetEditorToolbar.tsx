import { editorTheme as t } from '../../theme/editorTheme';
import { styles } from '../../theme/styleHelpers';

type AudiosheetEditorToolbarProperties = {
    canDeleteCue: boolean;
    canPause: boolean;
    canPlay: boolean;
    canPlayCue: boolean;
    canSave: boolean;
    isSaving: boolean;
    onDeleteCue: () => void;
    onPause: () => void;
    onPlay: () => void;
    onPlayCue: () => void;
    onSave: () => void;
    onStop: () => void;
    uiScale: number;
};

export function AudiosheetEditorToolbar({
    canDeleteCue,
    canPause,
    canPlay,
    canPlayCue,
    canSave,
    isSaving,
    onDeleteCue,
    onPause,
    onPlay,
    onPlayCue,
    onSave,
    onStop,
    uiScale,
}: AudiosheetEditorToolbarProperties) {
    const buttonStyle = (disabled: boolean, primary = false) => ({
        ...styles.buttonBase(uiScale),
        background: primary ? t.accent.primary : 'transparent',
        border: primary ? 'none' : `1px solid ${t.border.button}`,
        color: primary ? '#fff' : t.text.normal,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
    });

    return (
        <div style={{ alignItems: 'center', display: 'flex', gap: 8 }}>
            <strong style={{ color: t.text.primary, marginRight: 'auto' }}>Audiosheet Editor</strong>
            <button disabled={!canPlay} onClick={onPlay} style={buttonStyle(!canPlay)} type="button">Play</button>
            <button disabled={!canPause} onClick={onPause} style={buttonStyle(!canPause)} type="button">Pause</button>
            <button disabled={!canPlay && !canPause} onClick={onStop} style={buttonStyle(!canPlay && !canPause)} type="button">Stop</button>
            <button disabled={!canPlayCue} onClick={onPlayCue} style={buttonStyle(!canPlayCue)} type="button">Play Cue</button>
            <button disabled={!canDeleteCue} onClick={onDeleteCue} style={buttonStyle(!canDeleteCue)} type="button">Delete Cue</button>
            <button disabled={!canSave || isSaving} onClick={onSave} style={buttonStyle(!canSave || isSaving, true)} type="button">{isSaving ? 'Saving...' : 'Save'}</button>
        </div>
    );
}

