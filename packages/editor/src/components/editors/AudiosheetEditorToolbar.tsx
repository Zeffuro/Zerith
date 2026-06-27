import type { AudioRegionBatchNamePreset } from '../../utils/audioRegions';

import { editorTheme as t } from '../../theme/editorTheme';
import { styles } from '../../theme/styleHelpers';

type AudiosheetEditorToolbarProperties = {
    canDeleteCue: boolean;
    canExportCues: boolean;
    canPause: boolean;
    canPlay: boolean;
    canPlayCue: boolean;
    canSave: boolean;
    cueExportNamePreset: AudioRegionBatchNamePreset;
    cueExportTargetFolder: string;
    isExportingCues: boolean;
    isSaving: boolean;
    onDeleteCue: () => void;
    onExportCueNamePresetChange: (preset: AudioRegionBatchNamePreset) => void;
    onExportCues: () => void;
    onExportCueTargetFolderChange: (targetFolder: string) => void;
    onPause: () => void;
    onPlay: () => void;
    onPlayCue: () => void;
    onSave: () => void;
    onStop: () => void;
    uiScale: number;
};

export function AudiosheetEditorToolbar({
    canDeleteCue,
    canExportCues,
    canPause,
    canPlay,
    canPlayCue,
    canSave,
    cueExportNamePreset,
    cueExportTargetFolder,
    isExportingCues,
    isSaving,
    onDeleteCue,
    onExportCueNamePresetChange,
    onExportCues,
    onExportCueTargetFolderChange,
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
        <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <strong style={{ color: t.text.primary, marginRight: 'auto' }}>Audiosheet Editor</strong>
            <button disabled={!canPlay} onClick={onPlay} style={buttonStyle(!canPlay)} type="button">Play</button>
            <button disabled={!canPause} onClick={onPause} style={buttonStyle(!canPause)} type="button">Pause</button>
            <button disabled={!canPlay && !canPause} onClick={onStop} style={buttonStyle(!canPlay && !canPause)} type="button">Stop</button>
            <button disabled={!canPlayCue} onClick={onPlayCue} style={buttonStyle(!canPlayCue)} type="button">Play Cue</button>
            <button disabled={!canDeleteCue} onClick={onDeleteCue} style={buttonStyle(!canDeleteCue)} type="button">Delete Cue</button>
            <select
                aria-label="Cue export name preset"
                disabled={isExportingCues}
                onChange={(event) => onExportCueNamePresetChange(event.target.value as AudioRegionBatchNamePreset)}
                style={selectStyle(uiScale)}
                value={cueExportNamePreset}
            >
                <option value="region-name-time">Cue name + time</option>
                <option value="source-time">Source + time</option>
            </select>
            <input
                aria-label="Cue export target folder"
                disabled={isExportingCues}
                onChange={(event) => onExportCueTargetFolderChange(event.target.value)}
                placeholder="assets/audio-regions"
                style={targetFolderInputStyle(uiScale)}
                value={cueExportTargetFolder}
            />
            <button disabled={!canExportCues || isExportingCues} onClick={onExportCues} style={buttonStyle(!canExportCues || isExportingCues)} type="button">{isExportingCues ? 'Saving Cues...' : 'Save All Cues'}</button>
            <button disabled={!canSave || isSaving} onClick={onSave} style={buttonStyle(!canSave || isSaving, true)} type="button">{isSaving ? 'Saving...' : 'Save'}</button>
        </div>
    );
}

function selectStyle(uiScale: number) {
    return {
        ...styles.input(uiScale),
        fontSize: `${11 * uiScale}px`,
        minHeight: `${28 * uiScale}px`,
        padding: `${3 * uiScale}px ${6 * uiScale}px`,
        width: `${130 * uiScale}px`,
    } as const;
}

function targetFolderInputStyle(uiScale: number) {
    return {
        ...styles.input(uiScale),
        fontSize: `${11 * uiScale}px`,
        minHeight: `${28 * uiScale}px`,
        padding: `${3 * uiScale}px ${6 * uiScale}px`,
        width: `${170 * uiScale}px`,
    } as const;
}
