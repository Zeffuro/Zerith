import { buildCommandPaletteActions, type CommandPaletteActionDeps, type PaletteAction } from './commandPaletteActionsModel';
import { filterActions } from './commandPaletteModel';

type BuildCommandPaletteFilteredActionsArguments = {
    actionDeps: CommandPaletteActionDeps;
    query: string;
};

type BuildCommandPaletteFilteredActionsDependencies = {
    buildActions: (deps: CommandPaletteActionDeps) => PaletteAction[];
    filterActionsByQuery: (actions: PaletteAction[], query: string) => PaletteAction[];
};

export function buildCommandPaletteFilteredActions(
    { actionDeps, query }: BuildCommandPaletteFilteredActionsArguments,
    {
        buildActions = buildCommandPaletteActions,
        filterActionsByQuery = filterActions,
    }: Partial<BuildCommandPaletteFilteredActionsDependencies> = {},
): PaletteAction[] {
    const actions = buildActions(actionDeps);
    return filterActionsByQuery(actions, query);
}

