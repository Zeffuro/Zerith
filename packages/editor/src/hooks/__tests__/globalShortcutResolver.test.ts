import { describe, expect, it } from 'vitest';

import { type GlobalShortcutEventLike, resolveGlobalShortcutAction } from '../globalShortcutResolver';

const baseEvent: GlobalShortcutEventLike = {
    altKey: false,
    ctrlKey: false,
    key: '',
    metaKey: false,
    shiftKey: false,
};

describe('resolveGlobalShortcutAction', () => {
    it('resolves playback chords with expected precedence', () => {
        expect(resolve(buildContext({ key: 'F5', shiftKey: true }, { isPlaybackRunning: true }))?.action).toBe('stopPlayback');
        expect(resolve(buildContext({ key: 'F5' }, { isPlaybackRunning: true }))?.action).toBe('continueOrPlay');
        expect(resolve(buildContext({ key: 'F10' }, { isPlaybackRunning: true }))?.action).toBe('stepPlayback');
        expect(resolve(buildContext({ key: ' ' }))?.action).toBe('audiosheetTogglePlayPause');
    });

    it('does not resolve guarded playback commands when playback is not running', () => {
        expect(resolve(buildContext({ key: 'F6' }, { isPlaybackRunning: false }))).toBeUndefined();
        expect(resolve(buildContext({ key: 'F11' }, { isPlaybackRunning: false }))).toBeUndefined();
    });

    it('resolves save, settings, and find chords', () => {
        expect(resolve(buildContext({ ctrlKey: true, key: 's', shiftKey: true }))?.action).toBe('saveAll');
        expect(resolve(buildContext({ altKey: true, ctrlKey: true, key: 's' }))?.action).toBe('openSettingsModal');
        expect(resolve(buildContext({ ctrlKey: true, key: 's' }))?.action).toBe('save');
        expect(resolve(buildContext({ ctrlKey: true, key: 'F', shiftKey: true }))?.action).toBe('openGlobalSearchFind');
        expect(resolve(buildContext({ ctrlKey: true, key: '=' }))?.action).toBe('zoomIn');
        expect(resolve(buildContext({ ctrlKey: true, key: '-' }))?.action).toBe('zoomOut');
        expect(resolve(buildContext({ ctrlKey: true, key: '0' }))?.action).toBe('zoomReset');
        expect(resolve(buildContext({ altKey: true, ctrlKey: true, key: 's' }))).not.toMatchObject({ action: 'save' });
    });

    it('applies key overrides per action', () => {
        expect(resolve(buildContext(
            { ctrlKey: true, key: 'k' },
            { keymapOverrides: { save: 'mod+k' } },
        ))?.action).toBe('save');

        expect(resolve(buildContext(
            { ctrlKey: true, key: 's' },
            { keymapOverrides: { save: 'mod+k' } },
        ))).toBeUndefined();

        expect(resolve(buildContext(
            { key: 'k' },
            { keymapOverrides: { save: 'mod+k' } },
        ))).toBeUndefined();
    });

    it('keeps binding precedence after overrides', () => {
        expect(resolve(buildContext(
            { ctrlKey: true, key: 'k', shiftKey: true },
            { keymapOverrides: { save: 'mod+shift+k', saveAll: 'mod+shift+k' } },
        ))?.action).toBe('saveAll');
    });

    it('falls back to default binding when override is malformed or empty', () => {
        expect(resolve(buildContext(
            { ctrlKey: true, key: 's' },
            { keymapOverrides: { save: 'mod+shift' } },
        ))?.action).toBe('save');

        expect(resolve(buildContext(
            { ctrlKey: true, key: 's' },
            { keymapOverrides: { save: '' } },
        ))?.action).toBe('save');
    });

    it('resolves precedence when overrides collide with another command', () => {
        expect(resolve(buildContext(
            { altKey: true, ctrlKey: true, key: 's' },
            { keymapOverrides: { save: 'alt+mod+s' } },
        ))?.action).toBe('openSettingsModal');
    });

    it('requires modifiers from override chords exactly', () => {
        expect(resolve(buildContext(
            { ctrlKey: true, key: 'k' },
            { keymapOverrides: { save: 'alt+mod+k' } },
        ))).toBeUndefined();

        expect(resolve(buildContext(
            { altKey: true, ctrlKey: true, key: 'k' },
            { keymapOverrides: { save: 'alt+mod+k' } },
        ))?.action).toBe('save');

        expect(resolve(buildContext(
            { altKey: true, ctrlKey: true, key: 'k', shiftKey: true },
            { keymapOverrides: { save: 'alt+mod+k' } },
        ))).toBeUndefined();
    });

    it('matches mod bindings with meta on macOS-like events', () => {
        expect(resolve(buildContext({ key: 's', metaKey: true }))?.action).toBe('save');
        expect(resolve(buildContext({ ctrlKey: true, key: 's', metaKey: true }))?.action).toBe('save');
    });

    it('blocks editor-phase commands while typing', () => {
        expect(resolve(buildContext({ ctrlKey: true, key: 'z' }, { isTypingTarget: true }))).toBeUndefined();
        expect(resolve(buildContext({ ctrlKey: true, key: 'f', shiftKey: true }, { isTypingTarget: true }))?.action)
            .toBe('openGlobalSearchFind');
        expect(resolve(buildContext({ key: 'q' }, { isTypingTarget: true }))).toBeUndefined();
        expect(resolve(buildContext({ key: ' ' }, { isTypingTarget: true }))).toBeUndefined();

        expect(resolve(buildContext(
            { ctrlKey: true, key: 'k' },
            { isTypingTarget: true, keymapOverrides: { undo: 'mod+k' } },
        ))).toBeUndefined();
    });

    it('blocks copy when console target is focused', () => {
        expect(resolve(buildContext({ ctrlKey: true, key: 'c' }, { isConsoleTarget: true }))).toBeUndefined();
        expect(resolve(buildContext({ ctrlKey: true, key: 'c' }, { isConsoleTarget: false }))?.action).toBe('copySelection');
    });

    it('ignores composed/default-prevented/process events', () => {
        expect(resolve(buildContext({ ctrlKey: true, defaultPrevented: true, key: 's' }))).toBeUndefined();
        expect(resolve(buildContext({ ctrlKey: true, isComposing: true, key: 's' }))).toBeUndefined();
        expect(resolve(buildContext({ ctrlKey: true, key: 'Process' }))).toBeUndefined();
    });
});

function buildContext(
    eventPatch: Partial<GlobalShortcutEventLike>,
    contextPatch?: Partial<Omit<Parameters<typeof resolveGlobalShortcutAction>[0], 'event'>>,
): Parameters<typeof resolveGlobalShortcutAction>[0] {
    return {
        event: {
            ...baseEvent,
            ...eventPatch,
        },
        isConsoleTarget: false,
        isPlaybackRunning: false,
        isTypingTarget: false,
        keymapOverrides: {},
        ...contextPatch,
    };
}

function resolve(context: Parameters<typeof resolveGlobalShortcutAction>[0]) {
    return resolveGlobalShortcutAction(context);
}

