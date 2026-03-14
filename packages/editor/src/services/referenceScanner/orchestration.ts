import type { ScriptPath } from '../../utils/scriptPathUtilities';
import type { ReferenceScannerResult } from './types';

import { resolveFilePath, resolveScenePath } from './paths';

type ScanTreeFunction = (
    value: unknown,
    path: ScriptPath,
    filePath: string,
    sceneName: string,
    result: ReferenceScannerResult,
) => void;

export function scanMacroReferences(
    projectPath: string,
    macros: Record<string, unknown>,
    macrosSource: string | undefined,
    result: ReferenceScannerResult,
    scanTree: ScanTreeFunction,
): void {
    const macrosFilePath = resolveFilePath(projectPath, macrosSource);
    const macroNames = Object.keys(macros).toSorted((a, b) => a.localeCompare(b));
    for (const [macroIndex, macroName] of macroNames.entries()) {
        const script = macros[macroName];
        if (!Array.isArray(script)) continue;
        scanTree(script, [macroIndex, 'body'], macrosFilePath, `macro:${macroName}`, result);
    }
}

export function scanSceneReferences(
    projectPath: string,
    scenes: Record<string, unknown>,
    sceneSources: Record<string, unknown>,
    result: ReferenceScannerResult,
    scanTree: ScanTreeFunction,
): void {
    for (const [sceneName, script] of Object.entries(scenes)) {
        if (!Array.isArray(script)) continue;

        const filePath = resolveScenePath(projectPath, sceneName, sceneSources);
        if (!filePath) continue;

        scanTree(script, [], filePath, sceneName, result);
    }
}


