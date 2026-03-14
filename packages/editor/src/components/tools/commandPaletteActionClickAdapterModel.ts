import type { PaletteAction } from './commandPaletteActionsModel';

import { executeSelectedAction } from './commandPaletteInteractionModel';

type BuildCommandPaletteActionClickHandlerArguments = {
    filteredActions: PaletteAction[];
    onRequestClose: () => void;
};

export function buildCommandPaletteActionClickHandler({
    filteredActions,
    onRequestClose,
}: BuildCommandPaletteActionClickHandlerArguments): (index: number) => void {
    return (index) => {
        void executeSelectedAction(filteredActions, index, onRequestClose);
    };
}

