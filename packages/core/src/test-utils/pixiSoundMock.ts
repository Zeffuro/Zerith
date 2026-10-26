import { vi } from 'vitest';

type LoadedCallback = (error?: Error | null) => void;

type SoundAddOptions = {
    loaded?: LoadedCallback;
    preload?: boolean;
    source?: ArrayBuffer;
    url: string;
};

export function createMockSound(isLoaded = true) {
    const resource = {
        destroy: vi.fn(() => { resource.media = undefined; }),
        instances: [] as { volume: number }[],
        isLoaded,
        media: {} as object | undefined,
        volume: 1,
    };
    return resource;
}

export function createPixiSoundMock() {
    const aliases = new Map<string, ReturnType<typeof createMockSound>>();
    return {
        add: vi.fn((url: string, options: SoundAddOptions) => {
            const loadedSound = createMockSound();
            aliases.set(url, loadedSound);
            options.loaded?.();
            return loadedSound;
        }),
        exists: vi.fn((url: string) => aliases.has(url)),
        find: vi.fn((url: string) => aliases.get(url)),
        init: vi.fn(),
        pause: vi.fn(),
        play: vi.fn(() => Promise.resolve()),
        remove: vi.fn((url: string) => {
            aliases.get(url)?.destroy();
            aliases.delete(url);
        }),
        removeAll: vi.fn(() => aliases.clear()),
        resume: vi.fn(),
        stop: vi.fn(),
        stopAll: vi.fn(),
        useLegacy: true,
        volumeAll: 1,
    };
}

