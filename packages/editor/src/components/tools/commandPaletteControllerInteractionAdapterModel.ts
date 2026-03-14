import type { KeyboardEventHandler } from 'react';

import type { PaletteAction } from './commandPaletteActionsModel';

import { buildCommandPaletteActionClickHandler } from './commandPaletteActionClickAdapterModel';
import { buildCommandPaletteInputKeyDownHandler } from './commandPaletteKeydownAdapterModel';

type BuildCommandPaletteControllerInteractionsArguments = {
    filteredActions: PaletteAction[];
    onRequestClose: () => void;
    selectedIndex: number;
    setSelectedIndex: (index: number) => void;
};

type BuildCommandPaletteControllerInteractionsDependencies = {
    buildActionClickHandler: typeof buildCommandPaletteActionClickHandler;
    buildInputKeyDownHandler: typeof buildCommandPaletteInputKeyDownHandler;
};

export function buildCommandPaletteControllerInteractions(
    {
        filteredActions,
        onRequestClose,
        selectedIndex,
        setSelectedIndex,
    }: BuildCommandPaletteControllerInteractionsArguments,
    {
        buildActionClickHandler = buildCommandPaletteActionClickHandler,
        buildInputKeyDownHandler = buildCommandPaletteInputKeyDownHandler,
    }: Partial<BuildCommandPaletteControllerInteractionsDependencies> = {},
): {
    handleActionClick: (index: number) => void;
    handleKeyDown: KeyboardEventHandler<HTMLInputElement>;
} {
    const handleKeyDown = buildInputKeyDownHandler({
        filteredActions,
        onRequestClose,
        selectedIndex,
        setSelectedIndex,
    });

    const handleActionClick = buildActionClickHandler({
        filteredActions,
        onRequestClose,
    });

    return {
        handleActionClick,
        handleKeyDown,
    };
}

