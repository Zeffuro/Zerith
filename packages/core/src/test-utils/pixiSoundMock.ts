import { vi } from 'vitest';

type LoadedCallback = (error?: Error | null) => void;

type SoundAddOptions = {
    loaded?: LoadedCallback;
    preload?: boolean;
    url: string;
};

export function createPixiSoundMock() {
    const aliases = new Map<string, { isLoaded: boolean }>();
    return {
        add: vi.fn((url: string, options: SoundAddOptions) => {
            const loadedSound = { isLoaded: true };
            aliases.set(url, loadedSound);
            options.loaded?.();
            return loadedSound;
        }),
        exists: vi.fn((url: string) => aliases.has(url)),
        find: vi.fn((url: string) => aliases.get(url)),
        init: vi.fn(),
        pause: vi.fn(),
        play: vi.fn(() => Promise.resolve()),
        remove: vi.fn((url: string) => aliases.delete(url)),
        removeAll: vi.fn(() => aliases.clear()),
        resume: vi.fn(),
        stop: vi.fn(),
        stopAll: vi.fn(),
        volumeAll: 1,
    };
}

