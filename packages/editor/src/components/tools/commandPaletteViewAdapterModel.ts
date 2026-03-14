import type { KeyboardEventHandler } from 'react';

import type { PaletteAction } from './commandPaletteActionsModel';
import type { CommandPaletteViewProps as CommandPaletteViewProperties } from './CommandPaletteView';

import { clampRenderSelection, shouldShowEmptyActions, toRenderableActions } from './commandPalettePresentationModel';

type BuildCommandPaletteViewPropertiesArguments = {
    filteredActions: PaletteAction[];
    onInputKeyDown: KeyboardEventHandler<HTMLInputElement>;
    onRequestClose: () => void;
    onRunAction: (index: number) => void;
    query: string;
    selectedIndex: number;
    setQuery: (value: string) => void;
    setSelectedIndex: (index: number) => void;
    uiScale: number;
};

export function buildCommandPaletteViewProps({
    filteredActions,
    onInputKeyDown,
    onRequestClose,
    onRunAction,
    query,
    selectedIndex,
    setQuery,
    setSelectedIndex,
    uiScale,
}: BuildCommandPaletteViewPropertiesArguments): CommandPaletteViewProperties {
    const actions = toRenderableActions(filteredActions);

    return {
        actions,
        onActionClick: (index) => {
            onRunAction(index);
        },
        onInputChange: (value) => {
            setQuery(value);
            setSelectedIndex(0);
        },
        onInputKeyDown,
        onRequestClose,
        query,
        selectedIndex: clampRenderSelection(selectedIndex, actions.length),
        showEmptyState: shouldShowEmptyActions(actions.length),
        uiScale,
    };
}

