import { describe, expect, it, vi } from 'vitest';

import { desktopEngineConfig, fullscreenShortcut, resolveDesktopPlayer } from '../desktopPlayer';

const metadata = { gameId: 'games.eveningshift.g123456789abc', height: 720, title: 'Evening Shift', width: 1280 };
const state = { fullscreen: false, height: 720, maximized: false, width: 1280 };
const key = (value: string, extra = {}) => ({ altKey: false, ctrlKey: false, key: value, metaKey: false, repeat: false, ...extra });

describe('desktop player boundary', () => {
    it('keeps desktop controls inactive in an ordinary web export', () => {
        expect(resolveDesktopPlayer({})).toBeUndefined();
        expect(resolveDesktopPlayer({ __ZERITH_DESKTOP__: metadata })).toBeUndefined();
    });

    it('rejects malformed injected game metadata', () => {
        for (const invalid of [{ ...metadata, gameId: '../other' }, { ...metadata, width: Infinity }, { ...metadata, height: 0 }, { ...metadata, title: 'a'.repeat(257) }]) {
            expect(resolveDesktopPlayer({ __TAURI_INTERNALS__: { invoke: vi.fn() }, __ZERITH_DESKTOP__: invalid })).toBeUndefined();
        }
    });

    it('accepts the native minimum height without losing display controls', () => {
        expect(resolveDesktopPlayer({ __TAURI_INTERNALS__: { invoke: vi.fn() }, __ZERITH_DESKTOP__: { ...metadata, height: 240 } })).toBeDefined();
    });

    it('uses only display commands and propagates native failures', async () => {
        const invoke = vi.fn().mockResolvedValue(state);
        const bridge = resolveDesktopPlayer({ __TAURI_INTERNALS__: { invoke }, __ZERITH_DESKTOP__: metadata })!;
        expect(await bridge.getState()).toEqual(state);
        await bridge.setFullscreen(true);
        expect(invoke.mock.calls).toEqual([['desktop_get_window_state', undefined], ['desktop_set_fullscreen', { fullscreen: true }]]);
        invoke.mockRejectedValueOnce(new Error('Window unavailable'));
        await expect(bridge.setFullscreen(false)).rejects.toThrow('Window unavailable');
    });

    it('rejects an invalid state returned by the native player', async () => {
        const bridge = resolveDesktopPlayer({ __TAURI_INTERNALS__: { invoke: vi.fn().mockResolvedValue({ fullscreen: 'yes' }) }, __ZERITH_DESKTOP__: metadata })!;
        await expect(bridge.getState()).rejects.toThrow('invalid window settings');
    });

    it('isolates slots and global variables for games sharing a browser origin', () => {
        const values = new Map<string, string>();
        const storage = { getItem: (key: string) => values.get(key), removeItem: (key: string) => values.delete(key), setItem: (key: string, value: string) => values.set(key, value) } as unknown as Storage;
        const first = desktopEngineConfig(metadata, storage).storage!;
        const second = desktopEngineConfig({ ...metadata, gameId: 'games.other.gabcdef012345' }, storage).storage!;
        first.setItem('zerith_save_1', 'first progress');
        first.setItem('zerith_save_global', '{"chapter":2}');
        expect(second.getItem('zerith_save_1')).toBeUndefined();
        expect(second.getItem('zerith_save_global')).toBeUndefined();
        second.setItem('zerith_save_1', 'other progress');
        second.removeItem('zerith_save_1');
        expect(first.getItem('zerith_save_1')).toBe('first progress');
        expect(desktopEngineConfig({ ...metadata, title: 'Late Shift' }, storage).storage!.getItem('zerith_save_1')).toBe('first progress');
        expect(desktopEngineConfig(metadata, storage).display?.scaleMode).toBe('fit');
    });
});

describe('desktop display shortcuts', () => {
    it('toggles fullscreen with F11 and Alt+Enter', () => {
        expect(fullscreenShortcut(key('F11'), false)).toBe(true);
        expect(fullscreenShortcut(key('Enter', { altKey: true }), true)).toBe(false);
    });
    it('leaves Escape available to the game menu in either display mode', () => {
        expect(fullscreenShortcut(key('Escape'), true)).toBeUndefined();
        expect(fullscreenShortcut(key('Escape'), false)).toBeUndefined();
        expect(fullscreenShortcut(key('Enter'), false)).toBeUndefined();
    });
    it('does not repeat toggles or take control-modified system shortcuts', () => {
        for (const extra of [{ repeat: true }, { ctrlKey: true }, { metaKey: true }]) expect(fullscreenShortcut(key('F11', extra), false)).toBeUndefined();
    });
});
