export const COMMAND_PALETTE_INPUT_ID = 'command-palette-input';
export const COMMAND_PALETTE_LISTBOX_ID = 'command-palette-results';

export interface CommandPaletteAccessibilityState {
    dialog: {
        'aria-label': string;
        'aria-modal': true;
        role: 'dialog';
    };
    input: {
        'aria-activedescendant'?: string;
        'aria-autocomplete': 'list';
        'aria-controls': string;
        'aria-expanded': true;
        'aria-label': string;
        id: string;
        role: 'combobox';
    };
    listbox: {
        'aria-label': string;
        id: string;
        role: 'listbox';
    };
    status: {
        'aria-live': 'polite';
        role: 'status';
    };
}

export function createCommandPaletteAccessibilityState(input: {
    actionCount: number;
    selectedIndex: number;
}): CommandPaletteAccessibilityState {
    const hasActiveOption = input.actionCount > 0;
    const activeOptionId = hasActiveOption
        ? getCommandPaletteOptionId(clampSelection(input.selectedIndex, input.actionCount))
        : undefined;

    return {
        dialog: {
            'aria-label': 'Command palette',
            'aria-modal': true,
            role: 'dialog',
        },
        input: {
            ...(activeOptionId ? { 'aria-activedescendant': activeOptionId } : {}),
            'aria-autocomplete': 'list',
            'aria-controls': COMMAND_PALETTE_LISTBOX_ID,
            'aria-expanded': true,
            'aria-label': 'Command palette search',
            id: COMMAND_PALETTE_INPUT_ID,
            role: 'combobox',
        },
        listbox: {
            'aria-label': 'Command palette results',
            id: COMMAND_PALETTE_LISTBOX_ID,
            role: 'listbox',
        },
        status: {
            'aria-live': 'polite',
            role: 'status',
        },
    };
}

export function createCommandPaletteOptionAccessibility(index: number, selected: boolean): {
    'aria-selected': boolean;
    id: string;
    role: 'option';
} {
    return {
        'aria-selected': selected,
        id: getCommandPaletteOptionId(index),
        role: 'option',
    };
}

export function getCommandPaletteOptionId(index: number): string {
    return `command-palette-option-${Math.max(0, Math.floor(index))}`;
}

function clampSelection(index: number, actionCount: number): number {
    if (actionCount <= 0) return 0;
    return Math.max(0, Math.min(index, actionCount - 1));
}
