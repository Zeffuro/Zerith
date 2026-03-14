export type ShortcutChord = {
    key: string;
    requireAlt: boolean;
    requireMod: boolean;
    requireShift: boolean;
};

export type ShortcutEventLike = {
    altKey: boolean;
    ctrlKey: boolean;
    key: string;
    metaKey: boolean;
    shiftKey: boolean;
};

export function normalizeShortcutChord(rawValue: string): string | undefined {
    const parsed = parseShortcutChord(rawValue);
    return parsed ? serializeShortcutChord(parsed) : undefined;
}

export function parseShortcutChord(rawValue: string): ShortcutChord | undefined {
    const tokens = rawValue
        .split('+')
        .map((token) => token.trim().toLowerCase())
        .filter((token) => token.length > 0);

    if (tokens.length === 0) return;

    const chord: ShortcutChord = {
        key: '',
        requireAlt: false,
        requireMod: false,
        requireShift: false,
    };

    for (const token of tokens) {
        if (isModuleToken(token)) {
            chord.requireMod = true;
            continue;
        }

        if (token === 'alt') {
            chord.requireAlt = true;
            continue;
        }

        if (token === 'shift') {
            chord.requireShift = true;
            continue;
        }

        if (chord.key.length > 0) return;
        chord.key = token;
    }

    return chord.key.length > 0 ? chord : undefined;
}

export function serializeShortcutChord(chord: ShortcutChord): string {
    const parts = [
        chord.requireMod ? 'mod' : undefined,
        chord.requireAlt ? 'alt' : undefined,
        chord.requireShift ? 'shift' : undefined,
        chord.key,
    ].filter((part): part is string => part !== undefined);

    return parts.join('+');
}

export function shortcutChordFromEvent(event: ShortcutEventLike): ShortcutChord | undefined {
    const key = normalizeEventKey(event.key);
    if (!key) return;

    return {
        key,
        requireAlt: event.altKey,
        requireMod: event.ctrlKey || event.metaKey,
        requireShift: event.shiftKey,
    };
}

function isModuleToken(value: string): boolean {
    return value === 'control' || value === 'ctrl' || value === 'cmd' || value === 'meta' || value === 'mod';
}

function normalizeEventKey(key: string): string | undefined {
    const lowered = key.trim().toLowerCase();
    if (lowered.length === 0) return;
    if (isModuleToken(lowered) || lowered === 'shift' || lowered === 'alt') return;
    if (lowered === ' ') return 'space';
    return lowered;
}

