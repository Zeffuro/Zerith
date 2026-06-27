import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mergeEngineConfigs } from '../bootstrapConfig';

type MockBootstrapEngineOptions = {
    config: {
        accessibility?: Record<string, unknown>;
        display?: Record<string, unknown>;
        text?: Record<string, unknown>;
    };
};

const mocks = vi.hoisted(() => {
    const engine = {
        destroy: vi.fn(),
        events: {
            off: vi.fn(),
            on: vi.fn(),
        },
        start: vi.fn(),
        startScreen: {
            show: vi.fn(() => Promise.resolve()),
        },
    };

    return {
        bootstrapEngine: vi.fn<(_options: MockBootstrapEngineOptions) => Promise<unknown>>(() => Promise.resolve(engine)),
        engine,
        parseSceneFile: vi.fn((sceneFile: { commands: unknown[] }) => sceneFile),
        resolveManifestValue: vi.fn(() => Promise.resolve({})),
        resolveScenes: vi.fn(() => Promise.resolve({
            intro: { commands: [] },
        })),
    };
});

vi.mock('core', () => ({
    bootstrapEngine: mocks.bootstrapEngine,
    EngineConfigSchema: {
        safeParse: (value: unknown) => ({ data: value, success: true }),
    },
    parseSceneFile: mocks.parseSceneFile,
    resolveManifestValue: mocks.resolveManifestValue,
    resolveScenes: mocks.resolveScenes,
}));

import { bootstrapPlayer } from '../bootstrapPlayer';

function announceDialogue() {}

describe('bootstrapPlayer runtime config helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('fetch', vi.fn((url: string | URL) => {
            const href = String(url);
            if (href === 'https://game.test/game.json') {
                return Promise.resolve(jsonResponse({
                    scenes: { intro: 'scenes/intro.json' },
                    startScene: 'intro',
                }));
            }

            if (href === 'https://game.test/engine.config.json') {
                return Promise.resolve(jsonResponse({
                    accessibility: {
                        captions: true,
                        reducedMotion: true,
                        textScale: 1.25,
                    },
                    text: {
                        markupMode: 'plain',
                    },
                }));
            }

            return Promise.reject(new Error(`Unexpected fetch: ${href}`));
        }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('deep-merges accessibility config from file and runtime overrides', () => {
        expect(mergeEngineConfigs(
            {
                accessibility: {
                    captions: true,
                    reducedMotion: true,
                    textScale: 1.25,
                },
                display: { height: 720, width: 1280 },
                text: { markupMode: 'plain' },
            },
            {
                accessibility: {
                    announceDialogue,
                    selfVoicing: true,
                },
                display: { width: 1920 },
                text: {},
            },
        )).toMatchObject({
            accessibility: {
                announceDialogue,
                captions: true,
                reducedMotion: true,
                selfVoicing: true,
                textScale: 1.25,
            },
            display: {
                height: 720,
                width: 1920,
            },
            text: {
                markupMode: 'plain',
            },
        });
    });

    it('passes merged accessibility config into the bootstrapped player engine', async () => {
        await bootstrapPlayer({
            baseUrl: 'https://game.test/',
            canvas: {} as HTMLCanvasElement,
            compiledContentUrl: false,
            config: {
                accessibility: {
                    selfVoicing: true,
                    typewriterSpeedMultiplier: 2,
                },
                display: { width: 1920 },
            },
        });

        const bootstrapOptions = mocks.bootstrapEngine.mock.calls[0]?.[0];
        expect(bootstrapOptions).toBeDefined();
        if (!bootstrapOptions) {
            throw new Error('bootstrapEngine was not called');
        }

        expect(bootstrapOptions.config.accessibility).toMatchObject({
            captions: true,
            reducedMotion: true,
            selfVoicing: true,
            textScale: 1.25,
            typewriterSpeedMultiplier: 2,
        });
        expect(bootstrapOptions.config.display).toMatchObject({
            height: 720,
            width: 1920,
        });
        expect(bootstrapOptions.config.text).toMatchObject({
            markupMode: 'plain',
        });
        expect(mocks.engine.startScreen.show).toHaveBeenCalledWith('intro');
        expect(mocks.engine.start).toHaveBeenCalledTimes(1);
    });
});

function jsonResponse(body: unknown, status = 200): Response {
    return {
        json: () => Promise.resolve(body),
        ok: status >= 200 && status < 300,
        status,
    } as Response;
}
