import type { StoryMapSource } from './storyMapModel';

import { useProjectStore, useScriptStore } from '../../store/storeBootstrap';
import { useEditorStore } from '../../store/useEditorStore';
import { openProjectEntry } from '../openProjectEntry';

export async function openStoryMapSource(source: StoryMapSource): Promise<void> {
    const { projectGeneration, projectPath } = useProjectStore.getState();
    await openProjectEntry(source.filePath, source.filePath.split(/[\\/]/).at(-1) ?? '', { forceView: source.scriptPath ? 'timeline' : 'json', jsonSelectionPath: source.jsonPath });
    const current = useProjectStore.getState();
    if (current.projectGeneration !== projectGeneration || current.projectPath !== projectPath) return;
    if (source.scriptPath && source.scriptPath.length > 0) {
        useScriptStore.getState().setSelectedNodePath(source.scriptPath);
        useEditorStore.getState().setSelectedNodePaths([source.scriptPath]);
        useEditorStore.getState().setSelectionAnchorPath(source.scriptPath);
    }
    globalThis.dispatchEvent(new CustomEvent('zerith:dock-select', { detail: 'editor' }));
}
