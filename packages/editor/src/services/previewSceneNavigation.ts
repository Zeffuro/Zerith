import type { EngineConfig, SceneMap, SceneNavigationCommandType } from 'core';

export function createPreviewSceneNavigationHandler(
    scenes: SceneMap,
): NonNullable<EngineConfig['onSceneNavigation']> {
    return (sceneName: string, commandType: SceneNavigationCommandType) => {
        if (commandType === 'scene_change') {
            return 'execute';
        }

        return Object.hasOwn(scenes, sceneName) ? 'execute' : 'skip';
    };
}
