import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@pixi/sound', async () => {
    const { createPixiSoundMock } = await import('../../test-utils/pixiSoundMock');
    return {
        sound: createPixiSoundMock(),
    };
});

import { sound } from '@pixi/sound';

import { AudioManager } from '../AudioManager';

type SoundMock = {
    add: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
};

describe('AudioManager.playSfx', () => {
    const soundMock = sound as unknown as SoundMock;

    beforeEach(() => {
        soundMock.add.mockClear();
        soundMock.exists.mockReset();
        soundMock.exists.mockReturnValue(false);
        soundMock.play.mockClear();
    });

    it('passes cue segment options through to pixi sound playback', async () => {
        const manager = new AudioManager({ sfxVolume: 0.5 });

        await manager.playSfx('assets/sfx/ui.wav', 0.8, {
            duration: 0.25,
            loop: true,
            start: 1.5,
        });

        expect(soundMock.play).toHaveBeenCalledWith('assets/sfx/ui.wav', {
            end: 1.75,
            loop: true,
            start: 1.5,
            volume: 0.4,
        });
    });

    it('defaults loop to false for non-cue playback', async () => {
        const manager = new AudioManager({ sfxVolume: 1 });

        await manager.playSfx('assets/sfx/hit.wav', 0.6);

        expect(soundMock.play).toHaveBeenCalledWith('assets/sfx/hit.wav', {
            end: undefined,
            loop: false,
            start: undefined,
            volume: 0.6,
        });
    });
});
