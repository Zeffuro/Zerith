import type { GlobalSearchMatch, GlobalSearchProjectData } from './contracts';
import type { ManifestFilePaths } from './manifestPaths';
import type { ResolvedGlobalSearchTextOptions } from './textSearch';

import { toRecord } from '../../utils/typeGuards';
import {
    formatMacroLabel,
    resolveSceneLocation,
    SCRIPT_BODY_PATH_SEGMENT,
} from './pathLabels';
import { scanScriptNodes } from './scan';

export function collectMacroMatches(
    matches: GlobalSearchMatch[],
    query: string,
    macros: GlobalSearchProjectData['macros'],
    filePaths: Pick<ManifestFilePaths, 'macrosPath'>,
    textOptions: ResolvedGlobalSearchTextOptions,
): void {
    const macroNames = Object.keys(macros).toSorted((a, b) => a.localeCompare(b));
    for (const [macroIndex, macroName] of macroNames.entries()) {
        const macroScript = macros[macroName];
        if (!Array.isArray(macroScript)) continue;

        scanScriptNodes(matches, {
            filePath: filePaths.macrosPath,
            kind: 'macro',
            label: formatMacroLabel(macroName),
            query,
            rootPath: [macroIndex, SCRIPT_BODY_PATH_SEGMENT],
            script: macroScript,
            textOptions,
        });
    }
}

export function collectSceneMatches(
    matches: GlobalSearchMatch[],
    query: string,
    scenes: GlobalSearchProjectData['scenes'],
    manifest: GlobalSearchProjectData['manifest'],
    projectPath: string,
    textOptions: ResolvedGlobalSearchTextOptions,
): void {
    const manifestRecord = toRecord(manifest);
    const scenesEntry = toRecord(manifestRecord.scenes);

    for (const [sceneName, sceneScript] of Object.entries(scenes)) {
        if (!Array.isArray(sceneScript)) continue;

        const sceneLocation = resolveSceneLocation(projectPath, sceneName, scenesEntry);
        if (!sceneLocation) continue;

        scanScriptNodes(matches, {
            filePath: sceneLocation.filePath,
            kind: 'scene',
            label: sceneLocation.label,
            query,
            rootPath: [],
            script: sceneScript,
            textOptions,
        });
    }
}

