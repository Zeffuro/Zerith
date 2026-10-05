import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolvePlayerBaseUrl } from '../playerBaseUrl';

afterEach(() => { vi.unstubAllGlobals(); });

describe('player export base URL', () => {
    it.each([
        ['/published-game/', 'https://games.test/published-game/'],
        ['https://cdn.test/game/', 'https://cdn.test/game/'],
        ['./content/', 'https://games.test/launch/content/'],
        ['/games/a&b/', 'https://games.test/games/a&b/'],
    ])('uses exported metadata %s instead of the compiled base', (content, expected) => {
        vi.stubGlobal('location', { href: 'https://games.test/launch/index.html' });
        vi.stubGlobal('document', { querySelector: () => ({ content }) });
        expect(resolvePlayerBaseUrl('/compiled-base/')).toBe(expected);
    });

    it.each([undefined, ''])('preserves compiled base resolution without an exported override', content => {
        vi.stubGlobal('location', { href: 'https://games.test/launch/index.html' });
        vi.stubGlobal('document', { querySelector: () => content === undefined ? undefined : { content } });
        expect(resolvePlayerBaseUrl('/compiled-base/')).toBe('https://games.test/compiled-base/');
        expect(resolvePlayerBaseUrl('./')).toBe('https://games.test/launch/');
    });
});
