import type { StoryMapSource } from './storyMapModel';

import { executeWorkbenchOpenAction } from '../../store/actions/workbenchOpenActions';
import { resolveProjectFilePath } from '../../store/project/projectPreparation';
import { useProjectStore, useScriptStore } from '../../store/storeBootstrap';
import { useEditorStore } from '../../store/useEditorStore';
import { useWorkbenchStore } from '../../store/useWorkbenchStore';
import { canonicalPathForComparison } from '../../utils/pathComparison';
import { openProjectEntry } from '../openProjectEntry';
import { isStoryMapSceneReadable } from './storyMapProject';

export async function openStoryMapSource(source: StoryMapSource): Promise<void> {
    const { projectGeneration, projectPath } = useProjectStore.getState();
    const key = canonicalPathForComparison(source.filePath);
    const existing = useWorkbenchStore.getState().tabs.find(tab => canonicalPathForComparison(tab.path) === key);
    const filePath = existing?.path ?? source.filePath;
    const isManifest = key === canonicalPathForComparison(resolveProjectFilePath(projectPath ?? '', 'game.json'));
    const expectedKind = isManifest ? 'manifest' : (source.scriptPath === undefined ? 'macros' : 'script');
    if (existing && (expectedKind !== 'script' || existing.kind !== expectedKind || (existing.dirty && !isStoryMapSceneReadable(existing.textContent)))) {
        if (existing.kind === 'characters') executeWorkbenchOpenAction({ action: 'setCharactersView', view: 'json' });
        if (existing.kind === 'engineConfig') executeWorkbenchOpenAction({ action: 'setEngineConfigView', view: 'json' });
        if (existing.kind === 'items') executeWorkbenchOpenAction({ action: 'setItemsView', view: 'json' });
        if (existing.kind === 'manifest') executeWorkbenchOpenAction({ action: 'setManifestView', view: 'json' });
        if (existing.kind === 'script') executeWorkbenchOpenAction({ action: 'setScriptView', view: 'json' });
        if (existing.kind === 'macros') executeWorkbenchOpenAction({ action: 'setMacrosView', view: 'json' });
        executeWorkbenchOpenAction({ action: 'openTab', tab: { ...existing, jsonSelectionPath: source.jsonPath, preferredView: 'json' } });
        globalThis.dispatchEvent(new CustomEvent('zerith:dock-select', { detail: 'editor' }));
        return;
    }
    await openProjectEntry(filePath, filePath.split(/[\\/]/).at(-1) ?? '', {
        forceView: source.scriptPath ? 'timeline' : 'json',
        jsonHintKind: isManifest ? undefined : (source.scriptPath === undefined ? 'macros' : 'script'),
        jsonSelectionPath: source.jsonPath,
    });
    const current = useProjectStore.getState();
    if (current.projectGeneration !== projectGeneration || current.projectPath !== projectPath) return;
    if (source.scriptPath && source.scriptPath.length > 0) {
        useScriptStore.getState().setSelectedNodePath(source.scriptPath);
        useEditorStore.getState().setSelectedNodePaths([source.scriptPath]);
        useEditorStore.getState().setSelectionAnchorPath(source.scriptPath);
    }
    globalThis.dispatchEvent(new CustomEvent('zerith:dock-select', { detail: 'editor' }));
}
