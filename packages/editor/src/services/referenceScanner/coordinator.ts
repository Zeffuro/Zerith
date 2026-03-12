import type { ScriptPath } from '../../utils/scriptPathUtilities';
import type { GlobalSearchProjectData } from '../globalSearch/contracts';
import type { ReferenceScannerResult } from '../referenceScanner';

import { toRecord } from '../../utils/typeGuards';
import { scanMacroReferences, scanSceneReferences } from './orchestration';

type ScanTreeFn = (
    value: unknown,
    path: ScriptPath,
    filePath: string,
    sceneName: string,
    result: ReferenceScannerResult,
) => void;

export function scanProjectScriptBranches(
    projectData: Pick<GlobalSearchProjectData, 'macros' | 'manifest' | 'projectPath' | 'scenes'>,
    result: ReferenceScannerResult,
    scanTree: ScanTreeFn,
): void {
    const { macros, manifest, projectPath, scenes } = projectData;
    if (!projectPath) return;

    const manifestRecord = toRecord(manifest);
    const sceneSources = toRecord(manifestRecord.scenes);
    scanSceneReferences(projectPath, scenes, sceneSources, result, scanTree);

    const macrosSource = typeof manifestRecord.macros === 'string' ? manifestRecord.macros : undefined;
    scanMacroReferences(projectPath, macros, macrosSource, result, scanTree);
}


