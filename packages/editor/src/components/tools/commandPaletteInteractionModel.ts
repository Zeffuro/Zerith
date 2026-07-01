import { nextSelectionIndex } from './commandPaletteModel';

export type CommandPaletteInteractionResult =
    | { index: number; kind: 'execute' }
    | { kind: 'close' }
    | { kind: 'select'; nextIndex: number };

export type CommandPaletteInteractionState = {
    actionCount: number;
    selectedIndex: number;
};

type ExecutableAction = {
    action: () => Promise<void> | void;
    disabledReason?: string;
};

export function clampSelectionIndex(index: number, length: number): number {
    if (length <= 0) return 0;
    if (index < 0) return 0;
    if (index >= length) return length - 1;
    return index;
}

export async function executeSelectedAction(
    actions: ExecutableAction[],
    index: number,
    onRequestClose: () => void,
): Promise<void> {
    const selected = actions[index];
    if (!selected) return;
    if (selected.disabledReason) return;

    await selected.action();
    onRequestClose();
}

export function reduceCommandPaletteKey(
    key: string,
    state: CommandPaletteInteractionState,
): CommandPaletteInteractionResult | undefined {
    const boundedSelection = clampSelectionIndex(state.selectedIndex, state.actionCount);

    if (key === 'ArrowDown') {
        return {
            kind: 'select',
            nextIndex: nextSelectionIndex(boundedSelection, state.actionCount, 1),
        };
    }

    if (key === 'ArrowUp') {
        return {
            kind: 'select',
            nextIndex: nextSelectionIndex(boundedSelection, state.actionCount, -1),
        };
    }

    if (key === 'Enter') {
        return {
            index: resolveExecuteIndex(state.selectedIndex, state.actionCount),
            kind: 'execute',
        };
    }

    if (key === 'Escape') {
        return { kind: 'close' };
    }
}

export function resolveExecuteIndex(selectedIndex: number, actionCount: number): number {
    if (actionCount <= 0) return selectedIndex;
    return selectedIndex;
}


