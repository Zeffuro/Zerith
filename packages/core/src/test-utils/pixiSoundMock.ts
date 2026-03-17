import { vi } from 'vitest';

type LoadedCallback = (error?: Error | null) => void;

type SoundAddOptions = {
    loaded?: LoadedCallback;
    preload?: boolean;
    url: string;
};

export function createPixiSoundMock() {
    return {
        add: vi.fn((_url: string, options: SoundAddOptions) => {
            options.loaded?.();
        }),
        exists: vi.fn(() => false),
        find: vi.fn(),
        init: vi.fn(),
        pause: vi.fn(),
        play: vi.fn(() => Promise.resolve()),
        removeAll: vi.fn(),
        resume: vi.fn(),
        stop: vi.fn(),
        stopAll: vi.fn(),
        volumeAll: 1,
    };
}

