import type { PaletteAction } from './commandPaletteActionsModel';

export type RenderablePaletteAction = {
    hintText: string;
    id: string;
    label: string;
};

export function clampRenderSelection(selectedIndex: number, actionCount: number): number {
    if (actionCount <= 0) return 0;
    if (selectedIndex < 0) return 0;
    if (selectedIndex >= actionCount) return actionCount - 1;
    return selectedIndex;
}

export function shouldShowEmptyActions(actionCount: number): boolean {
    return actionCount === 0;
}

export function toRenderableActions(actions: PaletteAction[]): RenderablePaletteAction[] {
    return actions.map((action) => ({
        hintText: action.hint ?? '',
        id: action.id,
        label: action.label,
    }));
}

