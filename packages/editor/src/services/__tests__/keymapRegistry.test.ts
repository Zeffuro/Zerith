import { describe, expect, it } from 'vitest';

import { globalShortcutBindings, isGlobalShortcutCommand } from '../keymapRegistry';

describe('globalShortcutBindings', () => {
    it('keeps precedence for overlapping save chords', () => {
        const actionsInOrder = globalShortcutBindings
            .filter((binding) => binding.keys.includes('s'))
            .map((binding) => binding.action);

        expect(actionsInOrder).toEqual(['saveAll', 'openSettingsModal', 'save']);
    });

    it('contains both playback and editor shortcut phases', () => {
        expect(globalShortcutBindings.some((binding) => binding.phase === 'global')).toBe(true);
        expect(globalShortcutBindings.some((binding) => binding.phase === 'editor')).toBe(true);
    });

    it('marks copy shortcut as console-blocked', () => {
        const copyBinding = globalShortcutBindings.find((binding) => binding.action === 'copySelection');

        expect(copyBinding).toBeDefined();
        expect(copyBinding?.disallowConsoleTarget).toBe(true);
        expect(copyBinding?.preventDefault).toBe('always');
    });

    it('recognizes valid global shortcut command ids', () => {
        expect(isGlobalShortcutCommand('save')).toBe(true);
        expect(isGlobalShortcutCommand('openSettingsModal')).toBe(true);
        expect(isGlobalShortcutCommand('audiosheetTogglePlayPause')).toBe(true);
        expect(isGlobalShortcutCommand('audiosheetSetLeftBoundary')).toBe(true);
        expect(isGlobalShortcutCommand('audiosheetSetRightBoundary')).toBe(true);
        expect(isGlobalShortcutCommand('zoomIn')).toBe(true);
        expect(isGlobalShortcutCommand('zoomOut')).toBe(true);
        expect(isGlobalShortcutCommand('zoomReset')).toBe(true);
        expect(isGlobalShortcutCommand('not-real')).toBe(false);
    });

    it('includes default audiosheet key bindings', () => {
        expect(globalShortcutBindings.find((binding) => binding.action === 'audiosheetTogglePlayPause')?.keys[0]).toBe('space');
        expect(globalShortcutBindings.find((binding) => binding.action === 'audiosheetSetLeftBoundary')?.keys[0]).toBe('q');
        expect(globalShortcutBindings.find((binding) => binding.action === 'audiosheetSetRightBoundary')?.keys[0]).toBe('e');
    });

    it('includes default zoom key bindings', () => {
        expect(globalShortcutBindings.find((binding) => binding.action === 'zoomIn')?.keys[0]).toBe('=');
        expect(globalShortcutBindings.find((binding) => binding.action === 'zoomOut')?.keys[0]).toBe('-');
        expect(globalShortcutBindings.find((binding) => binding.action === 'zoomReset')?.keys[0]).toBe('0');
    });
});

