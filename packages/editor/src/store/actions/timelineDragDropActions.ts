import type { ScriptPath } from '../../utils/scriptPathUtilities';

import { useScriptStore } from '../storeBootstrap';
import { executeSyncRootSelectionAfterMultiMoveAction } from './timelineSelectionActions';

const isDescendantPath = (possibleDescendant: ScriptPath, ancestor: ScriptPath) =>
    possibleDescendant.length > ancestor.length && ancestor.every((v, index) => possibleDescendant[index] === v);

export interface ExecuteTimelineDropActionOptions {
    arrayPath: ScriptPath;
    index: number;
    source: ScriptPath | undefined;
    sources: ScriptPath[] | undefined;
}

export function executeTimelineDropAction(options: ExecuteTimelineDropActionOptions): boolean {
    const { arrayPath, index, source, sources } = options;
    const scriptState = useScriptStore.getState();

    if (sources && sources.length > 1) {
        if (arrayPath.length > 0) return false;
        scriptState.moveTimelineNodesToArray(sources, arrayPath, index);
        executeSyncRootSelectionAfterMultiMoveAction(sources.length);
        return true;
    }

    if (!source) return false;
    if (isDescendantPath(arrayPath, source)) return false;

    scriptState.moveTimelineNode(source, arrayPath, index);
    return true;
}


