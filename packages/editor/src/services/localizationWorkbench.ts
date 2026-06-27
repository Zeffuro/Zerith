import { executeWorkbenchOpenAction } from '../store/actions/workbenchOpenActions';
import { useProjectStore } from '../store/storeBootstrap';
import { makeTabId } from '../store/useWorkbenchStore';

export type OpenLocalizationWorkbenchTabOptions = {
    query?: string;
};

export function openLocalizationWorkbenchTab(options: OpenLocalizationWorkbenchTabOptions = {}): boolean {
    const projectPath = useProjectStore.getState().projectPath;
    if (!projectPath) return false;

    const path = `${projectPath.replaceAll(/[\\/]+$/gu, '')}/game.json#localization`;
    executeWorkbenchOpenAction({
        action: 'openTab',
        tab: {
            id: makeTabId('localization', path),
            kind: 'localization',
            localizationFilter: options.query ?? '',
            path,
            title: 'Localization',
        },
    });

    return true;
}
