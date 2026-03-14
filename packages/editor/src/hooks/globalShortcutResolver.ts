import {
    type GlobalShortcutBinding,
    globalShortcutBindings,
    type GlobalShortcutCommand,
    type KeymapOverrides,
} from '../services/keymapRegistry';
import { parseShortcutChord, type ShortcutChord } from '../services/shortcutChord';

export type GlobalShortcutEventLike = {
    altKey: boolean;
    ctrlKey: boolean;
    defaultPrevented?: boolean;
    isComposing?: boolean;
    key: string;
    metaKey: boolean;
    shiftKey: boolean;
};

export type GlobalShortcutResolveContext = {
    event: GlobalShortcutEventLike;
    isConsoleTarget: boolean;
    isPlaybackRunning: boolean;
    isTypingTarget: boolean;
    keymapOverrides: KeymapOverrides;
};

export type ResolvedGlobalShortcut = {
    action: GlobalShortcutCommand;
    preventDefault: 'always' | 'whenHandled';
};

export function resolveGlobalShortcutAction(context: GlobalShortcutResolveContext): ResolvedGlobalShortcut | undefined {
    const { event } = context;
    if (event.defaultPrevented || event.isComposing || event.key === 'Process') return;

    const key = normalizeShortcutKey(event.key);

    for (const binding of globalShortcutBindings) {
        if (!matchesBinding(binding, key, context)) continue;
        return { action: binding.action, preventDefault: binding.preventDefault };
    }

    return;
}

function getEffectiveBindingChord(binding: GlobalShortcutBinding, overrides: KeymapOverrides): ShortcutChord {
    const defaultChord: ShortcutChord = {
        key: binding.keys[0],
        requireAlt: Boolean(binding.requireAlt),
        requireMod: Boolean(binding.requireMod),
        requireShift: Boolean(binding.requireShift),
    };

    const overrideChord = overrides[binding.action] ? parseShortcutChord(overrides[binding.action] ?? '') : undefined;
    return overrideChord ?? defaultChord;
}

function matchesBinding(
    binding: GlobalShortcutBinding,
    normalizedKey: string,
    context: GlobalShortcutResolveContext,
): boolean {
    const { event, isConsoleTarget, isPlaybackRunning, isTypingTarget, keymapOverrides } = context;

    const effectiveChord = getEffectiveBindingChord(binding, keymapOverrides);

    return effectiveChord.key === normalizedKey
        && !(binding.phase === 'editor' && isTypingTarget)
        && !(binding.disallowConsoleTarget && isConsoleTarget)
        && !(binding.requiresPlaybackRunning && !isPlaybackRunning)
        && effectiveChord.requireMod === (event.ctrlKey || event.metaKey)
        && effectiveChord.requireShift === event.shiftKey
        && effectiveChord.requireAlt === event.altKey;
}

function normalizeShortcutKey(value: string): string {
    return value.trim().toLowerCase();
}

