export type AudiosheetShortcutAction =
    | 'deleteSelectedCue'
    | 'setLeftBoundary'
    | 'setRightBoundary'
    | 'togglePlayPause';

export type AudiosheetShortcutDetail = {
    action: AudiosheetShortcutAction;
};

export const audiosheetShortcutEventName = 'zerith:audiosheet-shortcut';

export function dispatchAudiosheetShortcut(action: AudiosheetShortcutAction): void {
    globalThis.dispatchEvent(new CustomEvent<AudiosheetShortcutDetail>(audiosheetShortcutEventName, {
        detail: { action },
    }));
}

