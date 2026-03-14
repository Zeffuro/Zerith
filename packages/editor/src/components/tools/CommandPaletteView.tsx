import type { KeyboardEventHandler } from 'react';

import type { RenderablePaletteAction } from './commandPalettePresentationModel';

import { CommandPaletteFooterHint } from './CommandPaletteFooterHint';
import { CommandPaletteInput } from './CommandPaletteInput';
import { CommandPaletteResultsList } from './CommandPaletteResultsList';
import { CommandPaletteShell } from './CommandPaletteShell';

export type CommandPaletteViewProps = {
    actions: RenderablePaletteAction[];
    onActionClick: (index: number) => void;
    onInputChange: (value: string) => void;
    onInputKeyDown: KeyboardEventHandler<HTMLInputElement>;
    onRequestClose: () => void;
    query: string;
    selectedIndex: number;
    showEmptyState: boolean;
    uiScale: number;
};

export function CommandPaletteView({
    actions,
    onActionClick,
    onInputChange,
    onInputKeyDown,
    onRequestClose,
    query,
    selectedIndex,
    showEmptyState,
    uiScale,
}: CommandPaletteViewProps) {
    return (
        <CommandPaletteShell onRequestClose={onRequestClose} uiScale={uiScale}>
            <CommandPaletteInput
                onInputChange={onInputChange}
                onInputKeyDown={onInputKeyDown}
                query={query}
                uiScale={uiScale}
            />

            <CommandPaletteResultsList
                actions={actions}
                onActionClick={onActionClick}
                selectedIndex={selectedIndex}
                showEmptyState={showEmptyState}
                uiScale={uiScale}
            />

            <CommandPaletteFooterHint uiScale={uiScale} />
        </CommandPaletteShell>
    );
}

