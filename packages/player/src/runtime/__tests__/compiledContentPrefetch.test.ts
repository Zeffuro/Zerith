import type { CompiledContentManifest, Script } from 'zerith-core';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    collectCompiledAssetUrls,
    collectLikelyNextScenes,
    createRuntimeContentPrefetcher,
    loadCompiledContentManifest,
    resolveCompiledCacheUrl,
} from '../compiledContentPrefetch';

const compiledContent: CompiledContentManifest = {
    $schema: 'zerith/compiled-content',
    assets: {
        all: {
            audio: ['/assets/sfx/click.wav', '/assets/voice/ending.ogg'],
            audiosheets: [],
            spritesheets: ['/assets/sprites/hero.sheet.json'],
            textures: ['/assets/bg/intro.svg', '/assets/bg/ending.svg', '/assets/items/badge.svg'],
        },
        byScene: {
            ending: {
                audio: ['/assets/voice/ending.ogg'],
                audiosheets: [],
                spritesheets: [],
                textures: ['/assets/bg/ending.svg'],
            },
            intro: {
                audio: ['/assets/sfx/click.wav'],
                audiosheets: [],
                spritesheets: ['/assets/sprites/hero.sheet.json'],
                textures: ['/assets/bg/intro.svg'],
            },
        },
        global: {
            audio: [],
            audiosheets: [],
            spritesheets: [],
            textures: ['/assets/items/badge.svg'],
        },
    },
    compilerVersion: 1,
    scenes: {
        ending: {
            commandCount: 1,
            dependencies: {
                audio: ['/assets/voice/ending.ogg'],
                audiosheets: [],
                spritesheets: [],
                textures: ['/assets/bg/ending.svg'],
            },
        },
        intro: {
            commandCount: 2,
            dependencies: {
                audio: ['/assets/sfx/click.wav'],
                audiosheets: [],
                spritesheets: ['/assets/sprites/hero.sheet.json'],
                textures: ['/assets/bg/intro.svg'],
            },
        },
    },
    source: {
        startScene: 'intro',
    },
};

const cachedCompiledContent: CompiledContentManifest = {
    ...compiledContent,
    cache: {
        algorithm: 'sha256',
        entries: {
            'assets/bg/intro.svg': {
                hash: 'intro-hash',
                kind: 'asset',
                size: 128,
            },
            'assets/items/badge.svg': {
                hash: 'badge-hash',
                kind: 'asset',
                size: 64,
            },
            'assets/sfx/click.wav': {
                hash: 'click-hash',
                kind: 'asset',
                size: 256,
            },
        },
    },
};

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('compiledContentPrefetch', () => {
    it('flattens dependency buckets in prefetch order', () => {
        expect(collectCompiledAssetUrls({
            audio: ['voice.ogg'],
            audiosheets: ['audio.sheet.json'],
            spritesheets: ['sprite.sheet.json'],
            textures: ['bg.png'],
        })).toEqual(['bg.png', 'voice.ogg', 'audio.sheet.json', 'sprite.sheet.json']);
    });

    it('collects likely next scenes from nested branch commands', () => {
        const script: Script = [
            {
                options: [
                    {
                        commands: [
                            { to: 'quiet_ending', type: 'jump' },
                        ],
                        label: 'Quiet',
                    },
                    {
                        commands: [
                            { commands: [{ to: 'bright_ending', type: 'jump' }], type: 'block' },
                        ],
                        label: 'Bright',
                    },
                ],
                type: 'choice',
            },
        ];

        expect(collectLikelyNextScenes(script)).toEqual(['bright_ending', 'quiet_ending']);
    });

    it('loads compiled manifests and treats 404 as optional', async () => {
        globalThis.fetch = vi.fn()
            .mockResolvedValueOnce({
                json: () => Promise.resolve(compiledContent),
                ok: true,
                status: 200,
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 404,
            });

        await expect(loadCompiledContentManifest('/zerith.content.json')).resolves.toBe(compiledContent);
        await expect(loadCompiledContentManifest('/missing.content.json')).resolves.toBeUndefined();
    });

    it('resolves local asset URLs through the compiled cache manifest', () => {
        expect(resolveCompiledCacheUrl('/assets/bg/intro.svg', cachedCompiledContent))
            .toBe('/assets/bg/intro.svg?v=intro-hash');
        expect(resolveCompiledCacheUrl('/assets/bg/intro.svg?quality=high#preview', cachedCompiledContent))
            .toBe('/assets/bg/intro.svg?quality=high&v=intro-hash#preview');
        expect(resolveCompiledCacheUrl('/assets/bg/ending.svg', cachedCompiledContent))
            .toBe('/assets/bg/ending.svg');
        expect(resolveCompiledCacheUrl('https://cdn.test/assets/bg/intro.svg', cachedCompiledContent))
            .toBe('https://cdn.test/assets/bg/intro.svg');
        expect(resolveCompiledCacheUrl('data:image/svg+xml,<svg />', cachedCompiledContent))
            .toBe('data:image/svg+xml,<svg />');
    });

    it('prefetches global, current scene, and likely next scene assets once', async () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn((url: RequestInfo | URL) => {
            void url;
            return Promise.resolve({ ok: true, status: 200 });
        });
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const scripts: Record<string, Script> = {
            ending: [],
            intro: [
                {
                    options: [
                        {
                            commands: [{ to: 'ending', type: 'jump' }],
                            label: 'End',
                        },
                    ],
                    type: 'choice',
                },
            ],
        };
        const prefetcher = createRuntimeContentPrefetcher({
            compiledContent,
            resolveAssetUrl: (assetUrl) => `https://game.test/${assetUrl.replace(/^\/+/u, '')}`,
            scripts,
        });

        prefetcher.prefetchGlobalAndScene('intro');
        prefetcher.prefetchLikelyNextScenes('intro');
        prefetcher.prefetchScene('intro');
        await vi.runAllTimersAsync();

        expect(fetchMock).toHaveBeenCalledTimes(6);
        expect(fetchMock.mock.calls.map((call) => call[0]).toSorted()).toEqual([
            'https://game.test/assets/bg/ending.svg',
            'https://game.test/assets/bg/intro.svg',
            'https://game.test/assets/items/badge.svg',
            'https://game.test/assets/sfx/click.wav',
            'https://game.test/assets/sprites/hero.sheet.json',
            'https://game.test/assets/voice/ending.ogg',
        ]);

        prefetcher.dispose();
    });

    it('prefers compiled next scene metadata over runtime script scans', async () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn((url: RequestInfo | URL) => {
            void url;
            return Promise.resolve({ ok: true, status: 200 });
        });
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const prefetcher = createRuntimeContentPrefetcher({
            compiledContent: {
                ...compiledContent,
                scenes: {
                    ...compiledContent.scenes,
                    intro: {
                        ...compiledContent.scenes.intro,
                        nextScenes: ['ending'],
                    },
                },
            },
            resolveAssetUrl: (assetUrl) => `https://game.test/${assetUrl.replace(/^\/+/u, '')}`,
            scripts: { intro: [] },
        });

        prefetcher.prefetchLikelyNextScenes('intro');
        await vi.runAllTimersAsync();

        expect(fetchMock.mock.calls.map((call) => call[0]).toSorted()).toEqual([
            'https://game.test/assets/bg/ending.svg',
            'https://game.test/assets/voice/ending.ogg',
        ]);

        prefetcher.dispose();
    });

    it('prefetches cached local assets with stable cache versions', async () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn((url: RequestInfo | URL) => {
            void url;
            return Promise.resolve({ ok: true, status: 200 });
        });
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const prefetcher = createRuntimeContentPrefetcher({
            compiledContent: cachedCompiledContent,
            resolveAssetUrl: (assetUrl) => `https://game.test/${assetUrl.replace(/^\/+/u, '')}`,
            scripts: { intro: [] },
        });

        prefetcher.prefetchGlobalAndScene('intro');
        prefetcher.prefetchScene('intro');
        await vi.runAllTimersAsync();

        expect(fetchMock).toHaveBeenCalledTimes(4);
        expect(fetchMock.mock.calls.map((call) => call[0]).toSorted()).toEqual([
            'https://game.test/assets/bg/intro.svg?v=intro-hash',
            'https://game.test/assets/items/badge.svg?v=badge-hash',
            'https://game.test/assets/sfx/click.wav?v=click-hash',
            'https://game.test/assets/sprites/hero.sheet.json',
        ]);

        prefetcher.dispose();
    });
});
