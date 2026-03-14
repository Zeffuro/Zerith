import { serializeShortcutChord } from './shortcutChord';

export const globalShortcutActionCommands = [
    'clearAllBreakpoints',
    'continueOrPlay',
    'copySelection',
    'duplicate',
    'moveSelectionDown',
    'moveSelectionUp',
    'openGlobalSearchFind',
    'openGlobalSearchReplace',
    'pasteSelection',
    'pausePlayback',
    'redo',
    'requestDelete',
    'save',
    'saveAll',
    'stepIntoPlayback',
    'stepOutPlayback',
    'stepPlayback',
    'stopPlayback',
    'toggleBreakpoint',
    'toggleCommandPalette',
    'toggleGlobalSearch',
    'undo',
] as const;

export type GlobalShortcutActionCommand = (typeof globalShortcutActionCommands)[number];
export type GlobalShortcutCommand = 'openSettingsModal' | GlobalShortcutActionCommand;
export type KeymapOverrides = Partial<Record<GlobalShortcutCommand, string>>;

const globalShortcutCommandSet = new Set<string>([
    ...globalShortcutActionCommands,
    'openSettingsModal',
]);

export type GlobalShortcutBinding = {
    action: GlobalShortcutCommand;
    disallowConsoleTarget?: boolean;
    keys: string[];
    phase: 'editor' | 'global';
    preventDefault: 'always' | 'whenHandled';
    requireAlt?: boolean;
    requireMod?: boolean;
    requireShift?: boolean;
    requiresPlaybackRunning?: boolean;
};

export type KeymapDisplayBinding = {
    action: GlobalShortcutCommand;
    defaultShortcut: string;
    key: string;
    requireAlt?: boolean;
    requireMod?: boolean;
    requireShift?: boolean;
};

export function isGlobalShortcutCommand(value: string): value is GlobalShortcutCommand {
    return globalShortcutCommandSet.has(value);
}

// Ordered from most specific to least specific to preserve current shortcut precedence.
export const globalShortcutBindings: readonly GlobalShortcutBinding[] = [
    { action: 'stopPlayback', keys: ['f5'], phase: 'global', preventDefault: 'whenHandled', requireShift: true },
    { action: 'continueOrPlay', keys: ['f5'], phase: 'global', preventDefault: 'whenHandled' },
    { action: 'pausePlayback', keys: ['f6'], phase: 'global', preventDefault: 'whenHandled', requiresPlaybackRunning: true },
    { action: 'toggleBreakpoint', keys: ['f9'], phase: 'global', preventDefault: 'whenHandled', requiresPlaybackRunning: true },
    { action: 'stepPlayback', keys: ['f10'], phase: 'global', preventDefault: 'whenHandled', requiresPlaybackRunning: true },
    { action: 'stepOutPlayback', keys: ['f11'], phase: 'global', preventDefault: 'whenHandled', requireShift: true, requiresPlaybackRunning: true },
    { action: 'stepIntoPlayback', keys: ['f11'], phase: 'global', preventDefault: 'whenHandled', requiresPlaybackRunning: true },
    { action: 'saveAll', keys: ['s'], phase: 'global', preventDefault: 'always', requireMod: true, requireShift: true },
    { action: 'openSettingsModal', keys: ['s'], phase: 'global', preventDefault: 'always', requireAlt: true, requireMod: true },
    { action: 'save', keys: ['s'], phase: 'global', preventDefault: 'always', requireMod: true },
    { action: 'openGlobalSearchFind', keys: ['f'], phase: 'global', preventDefault: 'always', requireMod: true, requireShift: true },
    { action: 'openGlobalSearchReplace', keys: ['g'], phase: 'global', preventDefault: 'always', requireMod: true, requireShift: true },
    { action: 'toggleCommandPalette', keys: ['p'], phase: 'global', preventDefault: 'always', requireMod: true, requireShift: true },
    { action: 'undo', keys: ['z'], phase: 'editor', preventDefault: 'always', requireMod: true },
    { action: 'redo', keys: ['y'], phase: 'editor', preventDefault: 'always', requireMod: true },
    { action: 'redo', keys: ['z'], phase: 'editor', preventDefault: 'always', requireMod: true, requireShift: true },
    { action: 'duplicate', keys: ['d'], phase: 'editor', preventDefault: 'always', requireMod: true },
    { action: 'requestDelete', keys: ['backspace', 'delete'], phase: 'editor', preventDefault: 'whenHandled' },
    { action: 'moveSelectionUp', keys: ['arrowup'], phase: 'editor', preventDefault: 'whenHandled', requireMod: true },
    { action: 'moveSelectionDown', keys: ['arrowdown'], phase: 'editor', preventDefault: 'whenHandled', requireMod: true },
    { action: 'copySelection', disallowConsoleTarget: true, keys: ['c'], phase: 'editor', preventDefault: 'always', requireMod: true },
    { action: 'pasteSelection', keys: ['v'], phase: 'editor', preventDefault: 'whenHandled', requireMod: true },
] as const;

export const keymapDisplayBindings: readonly KeymapDisplayBinding[] = (() => {
    const seen = new Set<GlobalShortcutCommand>();
    const bindings: KeymapDisplayBinding[] = [];

    for (const binding of globalShortcutBindings) {
        if (seen.has(binding.action)) continue;

        seen.add(binding.action);
        bindings.push({
            action: binding.action,
            defaultShortcut: serializeShortcutChord({
                key: binding.keys[0],
                requireAlt: Boolean(binding.requireAlt),
                requireMod: Boolean(binding.requireMod),
                requireShift: Boolean(binding.requireShift),
            }),
            key: binding.keys[0],
            requireAlt: binding.requireAlt,
            requireMod: binding.requireMod,
            requireShift: binding.requireShift,
        });
    }

    return bindings;
})();

