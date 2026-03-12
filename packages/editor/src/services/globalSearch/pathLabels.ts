import type { ScriptPath } from '../../utils/scriptPathUtilities';

export const GAME_MANIFEST_FILE = 'game.json';
export const MACRO_LABEL_PREFIX = 'Macro: ';
export const SCENE_INLINE_LABEL_SUFFIX = ' (inline)';
export const SCENE_LABEL_PREFIX = 'Scene: ';
export const SCRIPT_BODY_PATH_SEGMENT = 'body';

export function formatMacroLabel(macroName: string): string {
    return `${MACRO_LABEL_PREFIX}${macroName}`;
}

export function formatSceneLabel(sceneName: string): string {
    return `${SCENE_LABEL_PREFIX}${sceneName}`;
}

export function formatInlineSceneLabel(sceneName: string): string {
    return `${formatSceneLabel(sceneName)}${SCENE_INLINE_LABEL_SUFFIX}`;
}

export function resolveFilePath(projectPath: string, manifestPath: string | undefined): string {
    if (!manifestPath) return `${projectPath}/${GAME_MANIFEST_FILE}`;
    if (manifestPath.startsWith('/') || manifestPath.startsWith('\\')) {
        return `${projectPath}${manifestPath}`;
    }
    return `${projectPath}/${manifestPath}`;
}

export function resolveSceneLocation(
    projectPath: string,
    sceneName: string,
    manifestScenes: Record<string, unknown>,
): undefined | { filePath: string; label: string } {
    if (!(sceneName in manifestScenes)) return undefined;

    const source = manifestScenes[sceneName];
    if (typeof source === 'string') {
        return {
            filePath: resolveFilePath(projectPath, source),
            label: formatSceneLabel(sceneName),
        };
    }

    return {
        filePath: `${projectPath}/${GAME_MANIFEST_FILE}`,
        label: formatInlineSceneLabel(sceneName),
    };
}

export function toMacroName(label: string): string | undefined {
    return label.startsWith(MACRO_LABEL_PREFIX) ? label.slice(MACRO_LABEL_PREFIX.length) : undefined;
}

export function toMacroRelativePath(valuePath: ScriptPath): ScriptPath | undefined {
    if (valuePath.length < 2) return undefined;
    if (typeof valuePath[0] !== 'number') return undefined;
    if (valuePath[1] !== SCRIPT_BODY_PATH_SEGMENT) return undefined;
    return valuePath.slice(2);
}

export function toSceneName(label: string): string | undefined {
    if (!label.startsWith(SCENE_LABEL_PREFIX)) return undefined;
    const raw = label.slice(SCENE_LABEL_PREFIX.length);
    if (raw.endsWith(SCENE_INLINE_LABEL_SUFFIX)) return undefined;
    return raw;
}

