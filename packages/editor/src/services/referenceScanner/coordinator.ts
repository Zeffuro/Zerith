import type { ScriptPath } from '../../utils/scriptPathUtilities';
import type { GlobalSearchProjectData } from '../globalSearch';
import type { ReferenceScannerResult } from './types';

import { toRecord } from '../../utils/typeGuards';
import { scanMacroReferences, scanSceneReferences } from './orchestration';

type ScanTreeFunction = (
    value: unknown,
    path: ScriptPath,
    filePath: string,
    sceneName: string,
    result: ReferenceScannerResult,
) => void;

export function scanProjectScriptBranches(
    projectData: Pick<GlobalSearchProjectData, 'macros' | 'manifest' | 'projectPath' | 'scenes'>,
    result: ReferenceScannerResult,
    scanTree: ScanTreeFunction,
): void {
    const { macros, manifest, projectPath, scenes } = projectData;
    if (!projectPath) return;

    const manifestRecord = toRecord(manifest);
    const sceneSources = toRecord(manifestRecord.scenes);
    scanSceneReferences(projectPath, scenes, sceneSources, result, scanTree);

    const macrosSource = typeof manifestRecord.macros === 'string' ? manifestRecord.macros : undefined;
    scanMacroReferences(projectPath, macros, macrosSource, result, scanTree);
}


