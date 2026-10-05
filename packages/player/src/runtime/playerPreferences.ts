import type { EngineConfig } from '@zeffuro/zerith-core';

export interface PlayerPreferenceDialogue {
    setAutoAdvanceDelay(delay: number | undefined): void;
    setCaptionsEnabled(enabled: boolean): void;
    setReducedMotion(enabled: boolean): void;
    setSelfVoicingEnabled(enabled: boolean): void;
    setTextSize?(size: number): void;
    setTypewriterSpeed(delay: number): void;
}

export interface PlayerPreferenceEngine {
    audio: {
        muted: boolean;
        setMasterVolume(volume: number): void;
        setVolume(channel: 'bgm' | 'sfx' | 'voice', volume: number): void;
    };
    setAutoAdvance(delay: number | undefined): void;
    theme: { fontSize: number };
}

export interface PlayerPreferenceResult {
    preferences: PlayerPreferences;
    warning?: string;
}

export interface PlayerPreferences {
    autoAdvance: boolean;
    bgmVolume: number;
    captions: boolean;
    masterVolume: number;
    muted: boolean;
    reducedMotion: boolean;
    selfVoicing: boolean;
    sfxVolume: number;
    textSize: number;
    typewriterDelay: number;
    voiceVolume: number;
}

export interface PlayerPreferenceStorage {
    getItem(key: string): null | string | undefined;
    removeItem(key: string): void;
    setItem(key: string, value: string): void;
}

export const PLAYER_PREFERENCES_KEY = 'player_preferences';
const MAX_PREFERENCE_LENGTH = 4096;
const AUTO_ADVANCE_DELAY = 1500;
const BOOLEAN_KEYS = ['autoAdvance', 'captions', 'muted', 'reducedMotion', 'selfVoicing'] as const;
const VOLUME_KEYS = ['bgmVolume', 'masterVolume', 'sfxVolume', 'voiceVolume'] as const;
const NUMBER_RANGES = {
    bgmVolume: [0, 1],
    masterVolume: [0, 1],
    sfxVolume: [0, 1],
    textSize: [14, 40],
    typewriterDelay: [0, 120],
    voiceVolume: [0, 1],
} as const;

export function applyPlayerPreferences(
    engine: PlayerPreferenceEngine,
    value: PlayerPreferences,
    dialogue?: PlayerPreferenceDialogue,
): void {
    const preferences = normalizePlayerPreferences(value);
    engine.audio.setMasterVolume(preferences.masterVolume);
    for (const key of VOLUME_KEYS) {
        if (key !== 'masterVolume') engine.audio.setVolume(key === 'bgmVolume' ? 'bgm' : (key === 'sfxVolume' ? 'sfx' : 'voice'), preferences[key]);
    }
    engine.audio.muted = preferences.muted;
    engine.theme.fontSize = preferences.textSize;
    const autoAdvance = preferences.autoAdvance ? AUTO_ADVANCE_DELAY : undefined;
    engine.setAutoAdvance(autoAdvance);
    dialogue?.setAutoAdvanceDelay(autoAdvance);
    dialogue?.setCaptionsEnabled(preferences.captions);
    dialogue?.setReducedMotion(preferences.reducedMotion);
    dialogue?.setSelfVoicingEnabled(preferences.selfVoicing);
    dialogue?.setTextSize?.(preferences.textSize);
    dialogue?.setTypewriterSpeed(preferences.typewriterDelay);
}

export function createDefaultPlayerPreferences(config: EngineConfig = {}): PlayerPreferences {
    const audio = config.audio;
    const accessibility = config.accessibility;
    return {
        autoAdvance: false,
        bgmVolume: boundedNumber(audio?.bgmVolume, 1, 0, 1),
        captions: accessibility?.captions === true,
        masterVolume: boundedNumber(audio?.masterVolume, 1, 0, 1),
        muted: audio?.muted === true,
        reducedMotion: accessibility?.reducedMotion === true,
        selfVoicing: accessibility?.selfVoicing === true,
        sfxVolume: boundedNumber(audio?.sfxVolume, 1, 0, 1),
        textSize: Math.round(boundedNumber(boundedNumber(config.theme?.fontSize, 24, 1, 200)
            * boundedNumber(accessibility?.textScale, 1, 0.75, 2), 24, 14, 40)),
        typewriterDelay: Math.round(30 * boundedNumber(accessibility?.typewriterSpeedMultiplier, 1, 0, 4)),
        voiceVolume: boundedNumber(audio?.voiceVolume, 1, 0, 1),
    };
}

export function createPlayerPreferenceConfig(config: EngineConfig, value: PlayerPreferences): EngineConfig {
    const preferences = normalizePlayerPreferences(value);
    return {
        ...config,
        accessibility: {
            ...config.accessibility,
            captions: preferences.captions,
            reducedMotion: preferences.reducedMotion,
            selfVoicing: preferences.selfVoicing,
            textScale: 1,
            typewriterSpeedMultiplier: preferences.typewriterDelay / 30,
        },
        audio: {
            ...config.audio,
            bgmVolume: preferences.bgmVolume,
            masterVolume: preferences.masterVolume,
            muted: preferences.muted,
            sfxVolume: preferences.sfxVolume,
            voiceVolume: preferences.voiceVolume,
        },
        theme: { ...config.theme, fontSize: preferences.textSize },
    };
}

export function normalizePlayerPreferences(
    value: unknown,
    defaults: PlayerPreferences = createDefaultPlayerPreferences(),
): PlayerPreferences {
    const input = plainRecord(value) ?? {};
    const preferences = { ...defaults };
    for (const key of BOOLEAN_KEYS) {
        if (typeof input[key] === 'boolean') preferences[key] = input[key];
    }
    for (const key of Object.keys(NUMBER_RANGES) as (keyof typeof NUMBER_RANGES)[]) {
        const [min, max] = NUMBER_RANGES[key];
        const number = boundedNumber(input[key], defaults[key], min, max);
        preferences[key] = key === 'textSize' || key === 'typewriterDelay' ? Math.round(number) : number;
    }
    return preferences;
}

export function readPlayerPreferences(
    storage: PlayerPreferenceStorage | undefined,
    defaults: PlayerPreferences,
): PlayerPreferenceResult {
    const fallback = normalizePlayerPreferences(defaults);
    if (!storage) return { preferences: fallback };
    try {
        const serialized = storage.getItem(PLAYER_PREFERENCES_KEY);
        if (serialized === undefined || serialized === null) return { preferences: fallback };
        if (serialized.length > MAX_PREFERENCE_LENGTH) return invalidPreferences(fallback);
        const input = plainRecord(JSON.parse(serialized) as unknown);
        if (!input || input.version !== 1 || !validStoredPreferences(input)) return invalidPreferences(fallback);
        return { preferences: normalizePlayerPreferences(input, fallback) };
    } catch {
        return invalidPreferences(fallback, 'Saved player settings could not be read. Default settings are in use.');
    }
}

export function resetPlayerPreferences(
    storage: PlayerPreferenceStorage | undefined,
    defaults: PlayerPreferences,
): PlayerPreferenceResult {
    const preferences = normalizePlayerPreferences(defaults);
    return { preferences, ...writePlayerPreferences(storage, preferences) };
}

export function writePlayerPreferences(
    storage: PlayerPreferenceStorage | undefined,
    preferences: PlayerPreferences,
): { warning?: string } {
    if (!storage) return {};
    try {
        storage.setItem(PLAYER_PREFERENCES_KEY, JSON.stringify({ ...normalizePlayerPreferences(preferences), version: 1 }));
        return {};
    } catch {
        return { warning: 'Player settings could not be saved.' };
    }
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function invalidPreferences(preferences: PlayerPreferences, warning = 'Saved player settings were invalid. Default settings are in use.'): PlayerPreferenceResult {
    return { preferences, warning };
}

function plainRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return;
    return value as Record<string, unknown>;
}

function validStoredPreferences(input: Record<string, unknown>): boolean {
    const allowed = new Set<string>([...BOOLEAN_KEYS, ...Object.keys(NUMBER_RANGES), 'version']);
    if (Object.keys(input).some(key => !allowed.has(key))) return false;
    for (const key of BOOLEAN_KEYS) {
        if (input[key] !== undefined && typeof input[key] !== 'boolean') return false;
    }
    for (const key of Object.keys(NUMBER_RANGES) as (keyof typeof NUMBER_RANGES)[]) {
        const value = input[key];
        if (value === undefined) continue;
        const [min, max] = NUMBER_RANGES[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return false;
        if ((key === 'textSize' || key === 'typewriterDelay') && !Number.isInteger(value)) return false;
    }
    return true;
}
