export type PlayerPauseAction = 'history' | 'load' | 'resume' | 'save' | 'settings' | 'title';
export interface PlayerShellConfig {
    accentColor: string;
    actionLabels?: Partial<Record<PlayerPauseAction | PlayerTitleAction, string>>;
    background?: string;
    backgroundOpacity: number;
    buttonColor: string;
    buttonHeight: number;
    cornerStyle: 'pill' | 'rounded' | 'square';
    enabled: boolean;
    menuFont: 'monospace' | 'serif' | 'system';
    menuFontSize: number;
    menuWidth: number;
    panelColor: string;
    panelOpacity: number;
    pauseActions: PlayerPauseAction[];
    rememberSettings: boolean;
    saveSlots: number;
    subtitle?: string;
    textColor: string;
    title: string;
    titleActions: PlayerTitleAction[];
    titleAlignment: 'center' | 'left' | 'right';
}

export type PlayerTitleAction = 'continue' | 'load' | 'new-game' | 'settings';

const TITLE_ACTIONS: PlayerTitleAction[] = ['new-game', 'continue', 'load', 'settings'];
const PAUSE_ACTIONS: PlayerPauseAction[] = ['resume', 'save', 'load', 'history', 'settings', 'title'];

export function normalizePlayerAccentColor(value: unknown): string | undefined {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xFF_FF_FF) {
        return `#${value.toString(16).padStart(6, '0')}`;
    }
    if (typeof value === 'string' && /^#[\da-f]{6}$/iu.test(value)) return value.toLowerCase();
    return;
}

export function normalizePlayerBackground(value: unknown): string | undefined {
    if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return;
    try {
        const decoded = decodeURIComponent(value);
        if (decoded.startsWith('/') || /[\\?#:]/u.test(decoded)
            || [...decoded].some(character => (character.codePointAt(0) ?? 0) < 32)) return;
        if (decoded.split('/').some(part => ['', '.', '..'].includes(part))) return;
        return value;
    } catch {
        return;
    }
}

export function normalizePlayerShellConfig(player?: unknown, manifestTitle?: string): PlayerShellConfig {
    const input = plainRecord(player) ?? {};
    const background = normalizePlayerBackground(input.background);
    const subtitle = boundedText(input.subtitle, 240);
    const actionLabels = normalizeActionLabels(input.actionLabels);
    return {
        accentColor: normalizePlayerAccentColor(input.accentColor) ?? '#ffaaaa',
        backgroundOpacity: boundedNumber(input.backgroundOpacity, 0, 1, .45),
        buttonColor: normalizePlayerAccentColor(input.buttonColor) ?? '#232a3a',
        buttonHeight: boundedNumber(input.buttonHeight, 44, 80, 44, true),
        cornerStyle: enumValue(input.cornerStyle, ['rounded', 'square', 'pill'], 'rounded'),
        menuFont: enumValue(input.menuFont, ['system', 'serif', 'monospace'], 'system'),
        menuFontSize: boundedNumber(input.menuFontSize, 14, 24, 16, true),
        menuWidth: boundedNumber(input.menuWidth, 220, 600, 350, true),
        panelColor: normalizePlayerAccentColor(input.panelColor) ?? '#151923',
        panelOpacity: boundedNumber(input.panelOpacity, 0, 1, 245 / 255),
        textColor: normalizePlayerAccentColor(input.textColor) ?? '#f2f0f8',
        titleAlignment: enumValue(input.titleAlignment, ['left', 'center', 'right'], 'left'),
        ...(actionLabels ? { actionLabels } : {}),
        ...(background ? { background } : {}),
        enabled: booleanValue(input.enabled, true),
        pauseActions: normalizeActions(input.pauseActions, PAUSE_ACTIONS, 'resume'),
        rememberSettings: booleanValue(input.rememberSettings, true),
        saveSlots: typeof input.saveSlots === 'number' && Number.isFinite(input.saveSlots)
            ? Math.min(24, Math.max(1, Math.round(input.saveSlots))) : 6,
        ...(subtitle ? { subtitle } : {}),
        title: boundedText(input.title, 120) ?? boundedText(manifestTitle, 120) ?? 'Untitled game',
        titleActions: normalizeActions(input.titleActions, TITLE_ACTIONS, 'new-game'),
    };
}

function booleanValue(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function boundedNumber(value: unknown, min: number, max: number, fallback: number, integer = false): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(max, Math.max(min, integer ? Math.round(value) : value)) : fallback;
}

function boundedText(value: unknown, limit: number): string | undefined {
    if (typeof value !== 'string') return;
    const text = value.trim();
    return text.length > 0 && text.length <= limit ? text : undefined;
}

function enumValue<T extends string>(value: unknown, values: T[], fallback: T): T {
    return values.includes(value as T) ? value as T : fallback;
}

function normalizeActionLabels(value: unknown): PlayerShellConfig['actionLabels'] {
    const input = plainRecord(value);
    if (!input) return;
    const labels: NonNullable<PlayerShellConfig['actionLabels']> = {};
    for (const key of new Set([...TITLE_ACTIONS, ...PAUSE_ACTIONS])) {
        const label = boundedText(input[key], 80);
        if (label) labels[key] = label;
    }
    return Object.keys(labels).length > 0 ? labels : undefined;
}

function normalizeActions<T extends string>(value: unknown, defaults: T[], required: T): T[] {
    if (!Array.isArray(value) || value.length > defaults.length
        || !value.every((action: unknown) => typeof action === 'string' && defaults.includes(action as T))) {
        return [...defaults];
    }
    const actions = [...new Set(value as T[])];
    return actions.includes(required) ? actions : [required, ...actions];
}

function plainRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const prototype: unknown = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null ? value as Record<string, unknown> : undefined;
}
