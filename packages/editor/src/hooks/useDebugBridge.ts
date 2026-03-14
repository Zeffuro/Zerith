import type { Engine } from 'core';
import type { RefObject } from 'react';

import { useCallback } from 'react';

import { openProjectEntry } from '../services/openProjectEntry';
import { useProjectStore } from '../store/storeBootstrap';
import { useEditorStore } from '../store/useEditorStore';

export function useDebugBridge() {
    const attachDebugBridge = useCallback((engine: Engine, activeFileReference: RefObject<string | undefined>) => {
        const onFlowCommand = (sceneName: string, index: number) => {
            const editorState = useEditorStore.getState();
            editorState.setActiveExecutionPath([index]);

            const breakpointFilePath = getSceneDebugFilePath(sceneName, activeFileReference.current);
            if (breakpointFilePath && editorState.breakpoints[breakpointFilePath]?.includes(index)) {
                engine.pause();
            }
        };

        const onFlowPaused = (_sceneName: string, index: number) => {
            useEditorStore.getState().setActiveExecutionPath([index]);
            useEditorStore.getState().setPlaybackPaused(true);
        };

        const onFlowResumed = (_sceneName: string, index: number) => {
            useEditorStore.getState().setActiveExecutionPath([index]);
            useEditorStore.getState().setPlaybackPaused(false);
        };

        const onFlowSceneEntered = (sceneName: string, index: number) => {
            useEditorStore.getState().setActiveExecutionPath([index]);
            if (sceneName === 'preview') return;

            void syncEditorToEnteredScene(sceneName, index);
        };

        engine.events.on('flow:command', onFlowCommand);
        engine.events.on('flow:paused', onFlowPaused);
        engine.events.on('flow:resumed', onFlowResumed);
        engine.events.on('flow:scene_entered', onFlowSceneEntered);

        return () => {
            engine.events.off('flow:command', onFlowCommand);
            engine.events.off('flow:paused', onFlowPaused);
            engine.events.off('flow:resumed', onFlowResumed);
            engine.events.off('flow:scene_entered', onFlowSceneEntered);
        };
    }, []);

    return { attachDebugBridge };
}

function basename(path: string): string {
    return path.split(/[\\/]/).pop() || path;
}

function getSceneDebugFilePath(sceneName: string, fallbackActiveFile?: string): string | undefined {
    if (sceneName === 'preview') {
        return fallbackActiveFile;
    }

    const { manifest, projectPath } = useProjectStore.getState();
    const scenePathFromManifest = manifest?.scenes?.[sceneName];
    if (projectPath && typeof scenePathFromManifest === 'string') {
        return resolveProjectPath(projectPath, scenePathFromManifest);
    }

    if (!projectPath || !sceneName.endsWith('.json')) return undefined;
    return resolveProjectPath(projectPath, sceneName);
}

function resolveProjectPath(projectPath: string, targetPath: string): string {
    if (targetPath.startsWith('/') || targetPath.startsWith('\\')) {
        return `${projectPath}${targetPath}`;
    }
    return `${projectPath}/${targetPath}`;
}

async function syncEditorToEnteredScene(sceneName: string, index: number): Promise<void> {
    const scenePath = getSceneDebugFilePath(sceneName);
    if (!scenePath) return;

    const project = useProjectStore.getState();
    if (project.activeFile !== scenePath) {
        project.expandToPath(scenePath);
        await openProjectEntry(scenePath, basename(scenePath), { forceView: 'timeline' });
    }

    useEditorStore.getState().setActiveExecutionPath([index]);
}

