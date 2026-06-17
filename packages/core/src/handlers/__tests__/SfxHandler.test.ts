import { describe, expect, it, vi } from 'vitest';

import { createAssetManagerMock, createAudioManagerMock, createLoggerMock } from '../../test-utils/audioHarness';
import { SfxHandler } from '../SfxHandler';

const loadClickCueDescriptor: ReturnType<typeof createAssetManagerMock>['load'] = <T = unknown>() => Promise.resolve({
    cues: {
        click: { duration: 0.25, loop: true, start: 1.5, volume: 0.5 },
    },
    source: 'ui.wav',
} as T);

const loadMissingCueDescriptor: ReturnType<typeof createAssetManagerMock>['load'] = <T = unknown>() => Promise.resolve({
    cues: {},
    source: 'ui.wav',
} as T);

describe('SfxHandler', () => {
    it('plays standard sfx urls without cue parsing', async () => {
        const resolveMock = vi.fn((url: string) => Promise.resolve(`resolved:${url}`));
        const playSfxMock = vi.fn(() => Promise.resolve());
        const infoMock = vi.fn();

        const assets = createAssetManagerMock({ resolve: resolveMock });
        const audio = createAudioManagerMock({ playSfx: playSfxMock });
        const logger = createLoggerMock();
        logger.info = infoMock;

        const handler = new SfxHandler(assets, audio, logger);
        await handler.execute({ assetUrl: 'assets/sfx/hit.wav', type: 'sfx', volume: 0.6 });

        expect(resolveMock).toHaveBeenCalledWith('assets/sfx/hit.wav');
        expect(playSfxMock).toHaveBeenCalledWith('resolved:assets/sfx/hit.wav', 0.6);
        expect(infoMock).toHaveBeenCalledWith('Played SFX: assets/sfx/hit.wav');
    });

    it('resolves audiosheet cue references and plays only cue bounds', async () => {
        const loadMock = vi.fn(loadClickCueDescriptor) as ReturnType<typeof createAssetManagerMock>['load'];
        const resolveMock = vi.fn((url: string) => Promise.resolve(`resolved:${url}`));
        const loadAudiosheetMock = vi.fn(() => Promise.resolve());
        const playCueMock = vi.fn(() => Promise.resolve());
        const infoMock = vi.fn();

        const assets = createAssetManagerMock({
            load: loadMock,
            resolve: resolveMock,
        });
        const audio = createAudioManagerMock({
            loadAudiosheet: loadAudiosheetMock,
            playCue: playCueMock,
        });
        const logger = createLoggerMock();
        logger.info = infoMock;

        const handler = new SfxHandler(assets, audio, logger);
        await handler.execute({ assetUrl: 'assets/sfx/ui.sheet.json:click', type: 'sfx' });

        expect(loadMock).toHaveBeenCalledWith('assets/sfx/ui.sheet.json');
        expect(loadAudiosheetMock).toHaveBeenCalledWith(
            'assets/sfx/ui.sheet.json',
            {
                cues: {
                    click: { duration: 0.25, loop: true, start: 1.5, volume: 0.5 },
                },
                source: 'resolved:assets/sfx/ui.wav',
            },
        );
        expect(playCueMock).toHaveBeenCalledWith('assets/sfx/ui.sheet.json', 'click', { volume: 0.8 });
        expect(infoMock).toHaveBeenCalledWith('Played SFX cue: assets/sfx/ui.sheet.json:click');
    });

    it('accepts slash-prefixed audiosheet cue references', async () => {
        const loadMock = vi.fn(loadClickCueDescriptor) as ReturnType<typeof createAssetManagerMock>['load'];
        const loadAudiosheetMock = vi.fn(() => Promise.resolve());
        const playCueMock = vi.fn(() => Promise.resolve());

        const assets = createAssetManagerMock({
            load: loadMock,
            resolve: vi.fn((url: string) => Promise.resolve(`resolved:${url}`)),
        });
        const audio = createAudioManagerMock({
            loadAudiosheet: loadAudiosheetMock,
            playCue: playCueMock,
        });
        const logger = createLoggerMock();

        const handler = new SfxHandler(assets, audio, logger);
        await handler.execute({ assetUrl: '/assets/sfx/ui.sheet.json:click', type: 'sfx' });

        expect(loadMock).toHaveBeenCalledWith('/assets/sfx/ui.sheet.json');
        expect(loadAudiosheetMock).toHaveBeenCalledTimes(1);
        expect(playCueMock).toHaveBeenCalledWith('/assets/sfx/ui.sheet.json', 'click', { volume: 0.8 });
    });

    it('logs an error when cue lookup fails and does not play fallback audio', async () => {
        const loadMock = vi.fn(loadMissingCueDescriptor) as ReturnType<typeof createAssetManagerMock>['load'];
        const playSfxMock = vi.fn(() => Promise.resolve());
        const playCueMock = vi.fn(() => Promise.reject(new Error('missing cue')));
        const errorMock = vi.fn();

        const assets = createAssetManagerMock({ load: loadMock });
        const audio = createAudioManagerMock({
            playCue: playCueMock,
            playSfx: playSfxMock,
        });
        const logger = createLoggerMock();
        logger.error = errorMock;

        const handler = new SfxHandler(assets, audio, logger);
        await handler.execute({ assetUrl: 'assets/sfx/ui.sheet.json:missing', type: 'sfx' });

        expect(playSfxMock).not.toHaveBeenCalled();
        expect(errorMock).toHaveBeenCalledTimes(1);
    });
});
