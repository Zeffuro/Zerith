import type { ScriptPath } from '../../utils/scriptPathUtils';
import { useScriptStore } from '../useScriptStore';
import { executeSyncRootSelectionAfterMultiMoveAction } from './timelineSelectionActions';

const isDescendantPath = (possibleDescendant: ScriptPath, ancestor: ScriptPath) =>
    possibleDescendant.length > ancestor.length && ancestor.every((v, i) => possibleDescendant[i] === v);

export interface ExecuteTimelineDropActionOptions {
    source: ScriptPath | null;
    sources: ScriptPath[] | null;
    arrayPath: ScriptPath;
    index: number;
}

export function executeTimelineDropAction(options: ExecuteTimelineDropActionOptions): boolean {
    const { source, sources, arrayPath, index } = options;
    const scriptState = useScriptStore.getState();

    if (sources && sources.length > 1) {
        if (arrayPath.length !== 0) return false;
        scriptState.moveTimelineNodesToArray(sources, arrayPath, index);
        executeSyncRootSelectionAfterMultiMoveAction(sources.length);
        return true;
    }

    if (!source) return false;
    if (isDescendantPath(arrayPath, source)) return false;

    scriptState.moveTimelineNode(source, arrayPath, index);
    return true;
}

