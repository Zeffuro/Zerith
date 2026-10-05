import { describe, expect, it, vi } from 'vitest';

import type { PlayerPreferenceStorage } from '../playerPreferences';

import {
    applyPlayerPreferences,
    createDefaultPlayerPreferences,
    createPlayerPreferenceConfig,
    normalizePlayerPreferences,
    PLAYER_PREFERENCES_KEY,
    readPlayerPreferences,
    resetPlayerPreferences,
    writePlayerPreferences,
} from '../playerPreferences';

function memoryStorage(): PlayerPreferenceStorage {
    const values = new Map<string, string>();
    return {
        getItem: key => values.get(key),
        removeItem: key => { values.delete(key); },
        setItem: (key, value) => { values.set(key, value); },
    };
}

function unavailableStorage(): never {
    throw new Error('Denied');
}

describe('player preferences', () => {
    it('derives bounded defaults from authored engine settings with auto advance disabled', () => {
        const defaults = createDefaultPlayerPreferences({
            accessibility: { captions: true, reducedMotion: true, selfVoicing: true, textScale: 1.5, typewriterSpeedMultiplier: 2 },
            audio: { bgmVolume: 0.3, masterVolume: 0.5, muted: true, sfxVolume: 0.8, voiceVolume: 0.7 },
            theme: { fontSize: 20 },
        });
        expect(defaults).toEqual({
            autoAdvance: false,
            bgmVolume: 0.3,
            captions: true,
            masterVolume: 0.5,
            muted: true,
            reducedMotion: true,
            selfVoicing: true,
            sfxVolume: 0.8,
            textSize: 30,
            typewriterDelay: 60,
            voiceVolume: 0.7,
        });
        expect(createDefaultPlayerPreferences({ theme: { fontSize: 200 } }).textSize).toBe(40);
        expect(createDefaultPlayerPreferences({ accessibility: { typewriterSpeedMultiplier: Number.NaN } }).typewriterDelay).toBe(30);
    });

    it('bounds UI values and rejects malformed types and inherited properties', () => {
        expect(normalizePlayerPreferences({ masterVolume: 3, textSize: 8, typewriterDelay: 200, voiceVolume: -1 })).toMatchObject({
            masterVolume: 1, textSize: 14, typewriterDelay: 120, voiceVolume: 0,
        });
        expect(normalizePlayerPreferences({ captions: 'yes', masterVolume: Number.NaN, textSize: 20.4 })).toMatchObject({
            captions: false, masterVolume: 1, textSize: 20,
        });
        expect(normalizePlayerPreferences(Object.create({ muted: true }) as unknown)).toEqual(createDefaultPlayerPreferences());
    });

    it('persists and resets through each supplied game storage independently', () => {
        const first = memoryStorage();
        const second = memoryStorage();
        const defaults = createDefaultPlayerPreferences({ audio: { bgmVolume: 0.6 }, theme: { fontSize: 18 } });
        const changed = normalizePlayerPreferences({ autoAdvance: true, masterVolume: 0.4, textSize: 32 }, defaults);
        expect(writePlayerPreferences(first, changed)).toEqual({});
        expect(readPlayerPreferences(first, defaults)).toEqual({ preferences: changed });
        expect(readPlayerPreferences(second, defaults)).toEqual({ preferences: defaults });
        expect(first.getItem(PLAYER_PREFERENCES_KEY)).toContain('"version":1');
        expect(resetPlayerPreferences(first, defaults)).toEqual({ preferences: defaults });
        expect(readPlayerPreferences(first, defaults).preferences).toEqual(defaults);
    });

    it.each(['{', '[]', 'null', '{"version":2}', '{"version":1,"__proto__":{"muted":true}}', '{"version":1,"textSize":100}', '{"version":1,"typewriterDelay":0.5}', '{"version":1,"muted":1}', '{"version":1,"unknown":true}', ' '.repeat(4097)])('recovers safely from corrupt or unsupported stored data', serialized => {
        const storage = memoryStorage();
        storage.setItem(PLAYER_PREFERENCES_KEY, serialized);
        const defaults = createDefaultPlayerPreferences({ audio: { masterVolume: 0.8 } });
        const result = readPlayerPreferences(storage, defaults);
        expect(result.preferences).toEqual(defaults);
        expect(result.warning).toBeTruthy();
        expect(storage.getItem(PLAYER_PREFERENCES_KEY)).toBe(serialized);
    });

    it('survives blocked storage and accepts absence of a persistence provider', () => {
        const storage = { getItem: unavailableStorage, removeItem: unavailableStorage, setItem: unavailableStorage };
        const defaults = createDefaultPlayerPreferences();
        expect(readPlayerPreferences(storage, defaults).warning).toBeTruthy();
        expect(writePlayerPreferences(storage, defaults).warning).toBeTruthy();
        const result = resetPlayerPreferences(storage, defaults);
        expect(result.preferences).toEqual(defaults);
        expect(typeof result.warning).toBe('string');
        expect(readPlayerPreferences(undefined, defaults)).toEqual({ preferences: defaults });
        expect(writePlayerPreferences(undefined, defaults)).toEqual({});
    });

    it('applies settings through narrow setters without resetting active dialogue', () => {
        const engine = {
            audio: { muted: false, setMasterVolume: vi.fn(), setVolume: vi.fn() },
            setAutoAdvance: vi.fn(),
            theme: { fontSize: 24 },
        };
        const dialogue = {
            reset: vi.fn(),
            setAutoAdvanceDelay: vi.fn(),
            setCaptionsEnabled: vi.fn(),
            setReducedMotion: vi.fn(),
            setSelfVoicingEnabled: vi.fn(),
            setTextSize: vi.fn(),
            setTypewriterSpeed: vi.fn(),
        };
        const preferences = normalizePlayerPreferences({ autoAdvance: true, bgmVolume: 0.3, captions: true, masterVolume: 0.6, muted: true, reducedMotion: true, selfVoicing: true, textSize: 32, typewriterDelay: 60 });
        applyPlayerPreferences(engine, preferences, dialogue);
        expect(engine.audio.setMasterVolume).toHaveBeenCalledWith(0.6);
        expect(engine.audio.setVolume.mock.calls).toEqual([['bgm', 0.3], ['sfx', 1], ['voice', 1]]);
        expect(engine.audio.muted).toBe(true);
        expect(engine.theme.fontSize).toBe(32);
        expect(dialogue.setTextSize).toHaveBeenCalledWith(32);
        expect(dialogue.setTypewriterSpeed).toHaveBeenCalledWith(60);
        expect(dialogue.setCaptionsEnabled).toHaveBeenCalledWith(true);
        expect(dialogue.setSelfVoicingEnabled).toHaveBeenCalledWith(true);
        expect(dialogue.setReducedMotion).toHaveBeenCalledWith(true);
        expect(engine.setAutoAdvance).toHaveBeenCalledWith(1500);
        expect(dialogue.setAutoAdvanceDelay).toHaveBeenCalledWith(1500);
        expect(dialogue.reset).not.toHaveBeenCalled();
        applyPlayerPreferences(engine, createDefaultPlayerPreferences(), dialogue);
        expect(engine.setAutoAdvance.mock.calls.at(-1)).toEqual([undefined]);
        expect(dialogue.setAutoAdvanceDelay.mock.calls.at(-1)).toEqual([undefined]);
    });

    it('builds startup configuration preserving authored callbacks and unrelated fields', () => {
        const announceDialogue = vi.fn();
        const config = { accessibility: { announceDialogue, highContrast: true, textScale: 1.5 }, audio: { defaultBlipUrl: 'blip.ogg' }, debug: true, theme: { fontFamily: 'serif', fontSize: 20 } };
        const preferences = normalizePlayerPreferences({ captions: true, textSize: 32, typewriterDelay: 60 });
        const result = createPlayerPreferenceConfig(config, preferences);
        expect(result).toMatchObject({
            accessibility: { announceDialogue, captions: true, highContrast: true, textScale: 1, typewriterSpeedMultiplier: 2 },
            audio: { defaultBlipUrl: 'blip.ogg', masterVolume: 1 },
            debug: true,
            theme: { fontFamily: 'serif', fontSize: 32 },
        });
        expect(config.accessibility.textScale).toBe(1.5);
    });
});
