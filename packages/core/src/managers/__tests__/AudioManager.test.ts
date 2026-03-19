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
    stop: ReturnType<typeof vi.fn>;
};

describe('AudioManager.playSfx', () => {
    const soundMock = sound as unknown as SoundMock;

    beforeEach(() => {
        soundMock.add.mockClear();
        soundMock.exists.mockReset();
        soundMock.exists.mockReturnValue(false);
        soundMock.play.mockClear();
        soundMock.stop.mockClear();
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

    it('plays loaded audiosheet cues with cue bounds and cue volume scaling', async () => {
        const manager = new AudioManager({ sfxVolume: 0.5 });

        await manager.loadAudiosheet('assets/sfx/ui.sheet.json', {
            cues: {
                click: { duration: 0.25, start: 1.5, volume: 0.5 },
            },
            source: 'assets/sfx/ui.wav',
        });
        await manager.playCue('assets/sfx/ui.sheet.json', 'click', { volume: 0.8 });

        expect(soundMock.play).toHaveBeenCalledWith('assets/sfx/ui.wav', {
            end: 1.75,
            loop: false,
            start: 1.5,
            volume: 0.2,
        });
    });

    it('plays BGM cues as single-instance tracks and updates currentBgmUrl', async () => {
        const manager = new AudioManager({ bgmVolume: 0.5 });

        await manager.loadAudiosheet('assets/bgm/court.sheet.json', {
            cues: {
                loopMain: { duration: 16, start: 2 },
            },
            source: 'assets/bgm/court.mp3',
        });
        await manager.playCue('assets/bgm/court.sheet.json', 'loopMain', {
            channel: 'bgm',
            volume: 0.8,
        });

        expect(soundMock.play).toHaveBeenCalledWith('assets/bgm/court.mp3', {
            end: 18,
            loop: true,
            singleInstance: true,
            start: 2,
            volume: 0.4,
        });
        expect(manager.currentBgmUrl).toBe('assets/bgm/court.mp3');
    });

    it('stops previous BGM source when cue playback switches tracks', async () => {
        const manager = new AudioManager();
        manager.currentBgmUrl = 'assets/bgm/old.mp3';

        await manager.loadAudiosheet('assets/bgm/new.sheet.json', {
            cues: {
                intro: { start: 0 },
            },
            source: 'assets/bgm/new.mp3',
        });
        await manager.playCue('assets/bgm/new.sheet.json', 'intro', { channel: 'bgm' });

        expect(soundMock.stop).toHaveBeenCalledWith('assets/bgm/old.mp3');
    });
});
