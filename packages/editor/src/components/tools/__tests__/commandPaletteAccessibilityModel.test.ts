import { describe, expect, it } from 'vitest';

import {
    COMMAND_PALETTE_LISTBOX_ID,
    createCommandPaletteAccessibilityState,
    createCommandPaletteOptionAccessibility,
} from '../commandPaletteAccessibilityModel';

describe('commandPaletteAccessibilityModel', () => {
    it('wires the command palette as a dialog-backed combobox with active descendants', () => {
        const state = createCommandPaletteAccessibilityState({
            actionCount: 3,
            selectedIndex: 1,
        });

        expect(state.dialog).toEqual({
            'aria-label': 'Command palette',
            'aria-modal': true,
            role: 'dialog',
        });
        expect(state.input).toMatchObject({
            'aria-activedescendant': 'command-palette-option-1',
            'aria-controls': COMMAND_PALETTE_LISTBOX_ID,
            role: 'combobox',
        });
        expect(state.listbox).toMatchObject({
            id: COMMAND_PALETTE_LISTBOX_ID,
            role: 'listbox',
        });
    });

    it('omits active descendants when no commands are visible', () => {
        expect(createCommandPaletteAccessibilityState({
            actionCount: 0,
            selectedIndex: 4,
        }).input).not.toHaveProperty('aria-activedescendant');
    });

    it('marks options with deterministic ids and selected state', () => {
        expect(createCommandPaletteOptionAccessibility(2, true)).toEqual({
            'aria-selected': true,
            id: 'command-palette-option-2',
            role: 'option',
        });
    });
});
