import { describe, expect, it, vi } from 'vitest';

import {
    createAssetManagerMock,
    createAudioManagerMock,
    createEventBusMock,
    createLoggerMock,
    createStateManagerMock,
} from '../../test-utils/audioHarness';
import { BgmHandler } from '../BgmHandler';

const loadCourtCueDescriptor: ReturnType<typeof createAssetManagerMock>['load'] = <T = unknown>() => Promise.resolve({
    cues: {
        courtLoop: { duration: 8, loop: true, start: 2, volume: 0.5 },
    },
    source: 'court.mp3',
} as T);

const loadAbsoluteCueDescriptor: ReturnType<typeof createAssetManagerMock>['load'] = <T = unknown>() => Promise.resolve({
    cues: {
        intro: { start: 0 },
    },
    source: '/assets/bgm/intro.mp3',
} as T);

const loadIntroCueDescriptor: ReturnType<typeof createAssetManagerMock>['load'] = <T = unknown>() => Promise.resolve({
    cues: {
        intro: { start: 0 },
    },
    source: 'intro.mp3',
} as T);

describe('BgmHandler', () => {
    it('plays standard bgm urls through playBgm', async () => {
        const resolveMock = vi.fn((url: string) => `resolved:${url}`);
        const preloadAudioMock = vi.fn(() => Promise.resolve());
        const playBgmMock = vi.fn(() => Promise.resolve());

        const assets = createAssetManagerMock({ resolve: resolveMock });
        const audio = createAudioManagerMock({
            audioExists: vi.fn(() => false),
            playBgm: playBgmMock,
            preloadAudio: preloadAudioMock,
        });
        const logger = createLoggerMock();
        const state = createStateManagerMock();
        const events = createEventBusMock();

        const handler = new BgmHandler(assets, audio, logger, state, events);
        await handler.execute({ action: 'play', assetUrl: 'assets/bgm/theme.mp3', type: 'bgm', volume: 0.6 });

        expect(resolveMock).toHaveBeenCalledWith('assets/bgm/theme.mp3');
        expect(preloadAudioMock).toHaveBeenCalledWith('resolved:assets/bgm/theme.mp3');
        expect(playBgmMock).toHaveBeenCalledWith('resolved:assets/bgm/theme.mp3', true, 0.6);
        expect(state.system.bgm).toBe('assets/bgm/theme.mp3');
    });

    it('loads audiosheet descriptors and plays BGM cues', async () => {
        const loadMock = vi.fn(loadCourtCueDescriptor) as ReturnType<typeof createAssetManagerMock>['load'];
        const resolveMock = vi.fn((url: string) => `resolved:${url}`);
        const loadAudiosheetMock = vi.fn(() => Promise.resolve());
        const playCueMock = vi.fn(() => Promise.resolve());
        const playBgmMock = vi.fn(() => Promise.resolve());

        const assets = createAssetManagerMock({
            load: loadMock,
            resolve: resolveMock,
        });
        const audio = createAudioManagerMock({
            loadAudiosheet: loadAudiosheetMock,
            playBgm: playBgmMock,
            playCue: playCueMock,
        });
        const logger = createLoggerMock();
        const state = createStateManagerMock();
        const events = createEventBusMock();

        const handler = new BgmHandler(assets, audio, logger, state, events);
        await handler.execute({ action: 'play', assetUrl: 'assets/bgm/court.sheet.json:courtLoop', type: 'bgm', volume: 0.7 });

        expect(loadMock).toHaveBeenCalledWith('assets/bgm/court.sheet.json');
        expect(loadAudiosheetMock).toHaveBeenCalledWith('assets/bgm/court.sheet.json', {
            cues: {
                courtLoop: { duration: 8, loop: true, start: 2, volume: 0.5 },
            },
            source: 'resolved:assets/bgm/court.mp3',
        });
        expect(playCueMock).toHaveBeenCalledWith('assets/bgm/court.sheet.json', 'courtLoop', {
            channel: 'bgm',
            loop: undefined,
            volume: 0.7,
        });
        expect(playBgmMock).not.toHaveBeenCalled();
        expect(state.system.bgm).toBe('assets/bgm/court.sheet.json:courtLoop');
    });

    it('accepts slash-prefixed audiosheet cue references for bgm', async () => {
        const loadMock = vi.fn(loadAbsoluteCueDescriptor) as ReturnType<typeof createAssetManagerMock>['load'];
        const loadAudiosheetMock = vi.fn(() => Promise.resolve());
        const playCueMock = vi.fn(() => Promise.resolve());

        const assets = createAssetManagerMock({
            load: loadMock,
            resolve: vi.fn((url: string) => `resolved:${url}`),
        });
        const audio = createAudioManagerMock({
            loadAudiosheet: loadAudiosheetMock,
            playCue: playCueMock,
        });
        const logger = createLoggerMock();
        const state = createStateManagerMock();
        const events = createEventBusMock();

        const handler = new BgmHandler(assets, audio, logger, state, events);
        await handler.execute({ action: 'play', assetUrl: '/assets/bgm/intro.sheet.json:intro', type: 'bgm' });

        expect(loadMock).toHaveBeenCalledWith('/assets/bgm/intro.sheet.json');
        expect(playCueMock).toHaveBeenCalledWith('/assets/bgm/intro.sheet.json', 'intro', {
            channel: 'bgm',
            loop: undefined,
            volume: 0.5,
        });
    });

    it('logs an error when cue playback fails', async () => {
        const loadMock = vi.fn(loadIntroCueDescriptor) as ReturnType<typeof createAssetManagerMock>['load'];
        const errorMock = vi.fn();

        const assets = createAssetManagerMock({
            load: loadMock,
            resolve: vi.fn((url: string) => `resolved:${url}`),
        });
        const audio = createAudioManagerMock({
            loadAudiosheet: vi.fn(() => Promise.resolve()),
            playCue: vi.fn(() => Promise.reject(new Error('missing cue'))),
        });
        const logger = createLoggerMock();
        logger.error = errorMock;
        const state = createStateManagerMock();
        const events = createEventBusMock();

        const handler = new BgmHandler(assets, audio, logger, state, events);
        await handler.execute({ action: 'play', assetUrl: 'assets/bgm/intro.sheet.json:intro', type: 'bgm' });

        expect(errorMock).toHaveBeenCalledTimes(1);
        expect(state.system.bgm).toBeUndefined();
    });
});

