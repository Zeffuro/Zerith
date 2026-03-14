import type { KeyboardEventHandler } from 'react';

import type { PaletteAction } from './commandPaletteActionsModel';

import { executeSelectedAction, reduceCommandPaletteKey } from './commandPaletteInteractionModel';

type BuildCommandPaletteInputKeyDownHandlerArguments = {
    filteredActions: PaletteAction[];
    onRequestClose: () => void;
    selectedIndex: number;
    setSelectedIndex: (index: number) => void;
};

export function buildCommandPaletteInputKeyDownHandler({
    filteredActions,
    onRequestClose,
    selectedIndex,
    setSelectedIndex,
}: BuildCommandPaletteInputKeyDownHandlerArguments): KeyboardEventHandler<HTMLInputElement> {
    return (event) => {
        const interaction = reduceCommandPaletteKey(event.key, {
            actionCount: filteredActions.length,
            selectedIndex,
        });
        if (!interaction) return;

        event.preventDefault();

        if (interaction.kind === 'select') {
            setSelectedIndex(interaction.nextIndex);
            return;
        }

        if (interaction.kind === 'execute') {
            void executeSelectedAction(filteredActions, interaction.index, onRequestClose);
            return;
        }

        onRequestClose();
    };
}

