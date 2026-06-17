import type { Command } from 'core';

import { deepClone } from 'core';

import type { EditorNode } from '../../types/EditorNode';
import type { ScriptPath } from '../../utils/scriptPathUtilities';

import { dispatchAudiosheetShortcut } from '../../services/audiosheetShortcuts';
import { fsOpenPath } from '../../services/fs';
import { isTauriRuntime } from '../../services/runtime/runtimeEnvironment';
import { saveProjectAs } from '../../services/saveProjectAs';
import { getThemeRegistry } from '../../theme/themeRegistry';
import { isRecord } from '../../utils/typeGuards';
import { useProjectStore, useScriptStore } from '../storeBootstrap';
import { useEditorStore } from '../useEditorStore';
import { useSettingsStore } from '../useSettingsStore';
import { useWorkbenchStore } from '../useWorkbenchStore';

export type GlobalShortcutAction =
    | 'audiosheetSetLeftBoundary'
    | 'audiosheetSetRightBoundary'
    | 'audiosheetTogglePlayPause'
    | 'clearAllBreakpoints'
    | 'continueOrPlay'
    | 'copySelection'
    | 'duplicate'
    | 'moveSelectionDown'
    | 'moveSelectionUp'
    | 'openGlobalSearchFind'
    | 'openGlobalSearchReplace'
    | 'openNewProjectModal'
    | 'openProjectFolder'
    | 'pasteSelection'
    | 'pausePlayback'
    | 'redo'
    | 'requestDelete'
    | 'save'
    | 'saveAll'
    | 'saveProjectAs'
    | 'stepIntoPlayback'
    | 'stepOutPlayback'
    | 'stepPlayback'
    | 'stopPlayback'
    | 'toggleBreakpoint'
    | 'toggleCommandPalette'
    | 'toggleGlobalSearch'
    | 'toggleTheme'
    | 'undo'
    | 'zoomIn'
    | 'zoomOut'
    | 'zoomReset';

const UI_SCALE_DEFAULT = 1;
const UI_SCALE_MAX = 1.5;
const UI_SCALE_MIN = 0.8;
const UI_SCALE_STEP = 0.1;

type MacroClipboardNode = {
    __kind: 'macro_header';
    payload: MacroClipboardPayload;
};

type MacroClipboardPayload = {
    commands?: Command[];
    name?: string;
};

export async function executeGlobalShortcutAction(action: GlobalShortcutAction): Promise<boolean> {
    switch (action) {
        case 'audiosheetSetLeftBoundary': {
            return dispatchAudiosheetShortcutIfActive('setLeftBoundary');
        }

        case 'audiosheetSetRightBoundary': {
            return dispatchAudiosheetShortcutIfActive('setRightBoundary');
        }

        case 'audiosheetTogglePlayPause': {
            return dispatchAudiosheetShortcutIfActive('togglePlayPause');
        }

        case 'clearAllBreakpoints': {
            useEditorStore.getState().clearAllBreakpoints();
            return true;
        }

        case 'continueOrPlay': {
            const editor = useEditorStore.getState();
            if (isPlaybackRunning(editor)) {
                if (editor.isPlaybackPaused) {
                    editor.triggerResume();
                }
                return true;
            }
            editor.triggerPlay();
            return true;
        }

        case 'copySelection': {
            copySelectionToClipboard();
            return true;
        }

        case 'duplicate': {
            duplicateSelection();
            return true;
        }

        case 'moveSelectionDown': {
            return moveSelectionByArrow('down');
        }

        case 'moveSelectionUp': {
            return moveSelectionByArrow('up');
        }

        case 'openGlobalSearchFind': {
            useEditorStore.getState().openGlobalSearchPopup('find');
            return true;
        }

        case 'openGlobalSearchReplace': {
            useEditorStore.getState().openGlobalSearchPopup('replace');
            return true;
        }

        case 'openNewProjectModal': {
            useEditorStore.getState().openNewProjectModal();
            return true;
        }

        case 'openProjectFolder': {
            const projectPath = useProjectStore.getState().projectPath;
            if (!projectPath) return false;

            await fsOpenPath(projectPath);
            return true;
        }

        case 'pasteSelection': {
            return pasteClipboardSelection();
        }

        case 'pausePlayback': {
            const editor = useEditorStore.getState();
            if (!isPlaybackRunning(editor) || editor.isPlaybackPaused) return false;
            editor.triggerPause();
            return true;
        }

        case 'redo': {
            useScriptStore.getState().redo();
            return true;
        }

        case 'requestDelete': {
            return requestDeleteSelection();
        }

        case 'save': {
            useEditorStore.getState().markManualSave();
            await useProjectStore.getState().saveActiveFileFromCurrentScript();
            return true;
        }

        case 'saveAll': {
            useEditorStore.getState().markManualSave();
            await useProjectStore.getState().saveAllDirtyFiles();
            return true;
        }

        case 'saveProjectAs': {
            try {
                const project = useProjectStore.getState();
                if (!project.projectPath) return false;

                useEditorStore.getState().markManualSave();
                await project.saveAllDirtyFiles();

                const result = await saveProjectAs(project.projectPath);
                if (!result) return false;

                await project.openProjectFromManifest(result.manifestPath);
                if (isTauriRuntime()) useEditorStore.getState().addRecentProject(result.manifestPath);
                return true;
            } catch (error) {
                console.error('Save Project As shortcut failed:', error);
                return false;
            }
        }

        case 'stepIntoPlayback': {
            const editor = useEditorStore.getState();
            if (!isPlaybackRunning(editor) || !editor.isPlaybackPaused) return false;
            return false;
        }

        case 'stepOutPlayback': {
            const editor = useEditorStore.getState();
            if (!isPlaybackRunning(editor) || !editor.isPlaybackPaused) return false;
            return false;
        }

        case 'stepPlayback': {
            const editor = useEditorStore.getState();
            if (!isPlaybackRunning(editor) || !editor.isPlaybackPaused) return false;
            editor.triggerStep();
            return true;
        }

        case 'stopPlayback': {
            const editor = useEditorStore.getState();
            if (!isPlaybackRunning(editor)) return false;
            editor.triggerStop();
            return true;
        }

        case 'toggleBreakpoint': {
            return toggleBreakpointAtSelection();
        }

        case 'toggleCommandPalette': {
            useEditorStore.getState().toggleCommandPalette();
            return true;
        }

        case 'toggleGlobalSearch': {
            useEditorStore.getState().openGlobalSearchPopup('find');
            return true;
        }

        case 'toggleTheme': {
            const settings = useSettingsStore.getState();
            const themes = getThemeRegistry(settings.customThemes);
            if (themes.length === 0) return false;

            const index = themes.findIndex((theme) => theme.key === settings.themeKey);
            const nextTheme = index === -1
                ? themes[0]
                : themes[(index + 1) % themes.length];

            if (!nextTheme) return false;
            useEditorStore.getState().setThemeKey(nextTheme.key);
            return true;
        }

        case 'undo': {
            useScriptStore.getState().undo();
            return true;
        }

        case 'zoomIn': {
            adjustUiScale(UI_SCALE_STEP);
            return true;
        }

        case 'zoomOut': {
            adjustUiScale(-UI_SCALE_STEP);
            return true;
        }

        case 'zoomReset': {
            useEditorStore.getState().setUiScale(UI_SCALE_DEFAULT);
            return true;
        }
    }
}

function adjustUiScale(delta: number): void {
    const editor = useEditorStore.getState();
    const nextUiScale = clampUiScale(Math.round((editor.uiScale + delta) * 10) / 10);
    editor.setUiScale(nextUiScale);
}

function clampUiScale(value: number): number {
    return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, value));
}


function cloneValue<T>(value: T): T {
    return deepClone(value);
}

function copySelectionToClipboard(): void {
    const editingAllMacrosFile = useProjectStore.getState().editingAllMacrosFile;
    const editor = useEditorStore.getState();

    if (editingAllMacrosFile) {
        const root = editor.selectedNodePaths.find((p) => p.length === 1 && typeof p[0] === 'number');
        if (root) {
            const index = root[0] as number;
            const macro = useProjectStore.getState().macroEntries[index];
            if (macro) {
                editor.setClipboardNode({
                    __kind: 'macro_header',
                    payload: cloneValue(macro),
                });
            }
            return;
        }
    }

    const script = useScriptStore.getState();
    if (script.selectedNodePath) {
        const node = script.getNodeAtPath(script.selectedNodePath);
        if (node !== undefined) {
            editor.setClipboardNode(cloneValue(node));
        }
    }
}

function dispatchAudiosheetShortcutIfActive(action: Parameters<typeof dispatchAudiosheetShortcut>[0]): boolean {
    const activeTab = useWorkbenchStore.getState().activeTab();
    if (activeTab?.kind !== 'audiosheet') return false;
    dispatchAudiosheetShortcut(action);
    return true;
}

function duplicateSelection(): void {
    const editingAllMacrosFile = useProjectStore.getState().editingAllMacrosFile;
    const editor = useEditorStore.getState();

    if (editingAllMacrosFile) {
        const rootIndices = getUniqueSortedRootIndices(editor.selectedNodePaths);

        if (rootIndices.length > 0) {
            useProjectStore.getState().duplicateMacroEntries(rootIndices);
            const duplicated = rootIndices.map((index, index_) => index + 1 + index_);
            const dupPaths = duplicated.map((index) => [index] as ScriptPath);
            editor.setSelectedNodePaths(dupPaths);
            editor.setSelectionAnchorPath(dupPaths[0] ?? undefined);
        }
        return;
    }

    const script = useScriptStore.getState();

    if (editor.selectedNodePaths.length > 1) {
        const originals = getUniqueSortedRootIndices(editor.selectedNodePaths);

        script.duplicateNodesByPaths(editor.selectedNodePaths);

        const duplicated: number[] = [];
        for (let index = 0; index < originals.length; index++) duplicated.push(originals[index] + 1 + index);

        const dupPaths = duplicated.map((index) => [index] as ScriptPath);
        editor.setSelectedNodePaths(dupPaths);
        editor.setSelectionAnchorPath(dupPaths[0] ?? undefined);
        return;
    }

    if (script.selectedNodePath) {
        script.duplicateNodeByPath(script.selectedNodePath);
        const index =
            script.selectedNodePath.length === 1 && typeof script.selectedNodePath[0] === 'number'
                ? (script.selectedNodePath[0]) + 1
                : undefined;
        if (index !== undefined) {
            editor.setSelectedNodePaths([[index]]);
            editor.setSelectionAnchorPath([index]);
        }
    }
}

function getUniqueSortedRootIndices(paths: ScriptPath[]): number[] {
    return paths
        .filter((p) => Array.isArray(p) && p.length === 1 && typeof p[0] === 'number')
        .map((p) => p[0] as number)
        .filter((value, index, array) => array.indexOf(value) === index)
        .toSorted((a, b) => a - b);
}

function isEditorNode(value: unknown): value is EditorNode {
    return Boolean(value) && typeof value === 'object' && typeof (value as { type?: unknown }).type === 'string';
}

function isMacroClipboardNode(value: unknown): value is MacroClipboardNode {
    if (!isRecord(value)) return false;
    if (value.__kind !== 'macro_header') return false;
    return isRecord(value.payload);
}


function isPlaybackRunning(editor: ReturnType<typeof useEditorStore.getState>): boolean {
    return editor.playTrigger > editor.stopTrigger;
}

function moveSelectionByArrow(direction: 'down' | 'up'): boolean {
    const editingAllMacrosFile = useProjectStore.getState().editingAllMacrosFile;

    if (editingAllMacrosFile) {
        const editor = useEditorStore.getState();
        const selected = editor.selectedNodePaths;
        if (selected.length !== 1) return false;

        const p = selected[0];
        if (!p || p.length !== 1 || typeof p[0] !== 'number') return false;

        const index = p[0];
        const project = useProjectStore.getState();
        const total = project.macroEntries.length;

        if (direction === 'up') {
            if (index <= 0) return false;
            project.moveMacroEntries([index], index - 1);
            editor.setSelectedNodePaths([[index - 1]]);
            editor.setSelectionAnchorPath([index - 1]);
            return true;
        } else {
            if (index >= total - 1) return false;
            project.moveMacroEntries([index], index + 2);
            editor.setSelectedNodePaths([[index + 1]]);
            editor.setSelectionAnchorPath([index + 1]);
            return true;
        }
    }

    const script = useScriptStore.getState();
    const selectedNodePath = script.selectedNodePath;
    if (!selectedNodePath) return false;

    const parent = selectedNodePath.slice(0, -1);
    const index = selectedNodePath.at(-1);
    if (typeof index !== 'number') return false;

    const parentArray = script.getNodeAtPath(parent) as undefined | unknown[];
    if (!Array.isArray(parentArray)) return false;

    if (direction === 'up') {
        if (index <= 0) return false;
        script.moveNodeByPath(selectedNodePath, parent, index - 1);
        return true;
    } else {
        if (index >= parentArray.length - 1) return false;
        script.moveNodeByPath(selectedNodePath, parent, index + 2);
        return true;
    }
}

function pasteClipboardSelection(): boolean {
    const project = useProjectStore.getState();
    const editor = useEditorStore.getState();
    const clipboardNode = editor.clipboardNode;

    if (project.editingAllMacrosFile && isMacroClipboardNode(clipboardNode)) {
        const selected = editor.selectedNodePaths;
        const root = selected.find((p) => p.length === 1 && typeof p[0] === 'number');
        const insertAt = root ? ((root[0] as number) + 1) : project.macroEntries.length;

        const copied = clipboardNode.payload;
        const entries = [...project.macroEntries];

        const taken = new Set(entries.map((m) => m.name));
        let nextName = copied.name || 'macro_copy';
        if (taken.has(nextName)) {
            let index = 2;
            const base = `${nextName}_copy`;
            nextName = base;
            while (taken.has(nextName)) nextName = `${base}_${index++}`;
        }

        const inserted = {
            commands: cloneValue(Array.isArray(copied.commands) ? copied.commands : [] as Command[]),
            name: nextName,
        };

        entries.splice(Math.max(0, Math.min(insertAt, entries.length)), 0, inserted);
        project.setMacroEntries(entries);

        const newIndex = Math.max(0, Math.min(insertAt, entries.length - 1));
        editor.setSelectedNodePaths([[newIndex]]);
        editor.setSelectionAnchorPath([newIndex]);
        return true;
    }

    const script = useScriptStore.getState();
    if (script.selectedNodePath && isEditorNode(clipboardNode) && !isMacroClipboardNode(clipboardNode)) {
        script.pasteNodeAtPath(script.selectedNodePath, clipboardNode);
        return true;
    }

    return false;
}

function requestDeleteSelection(): boolean {
    if (dispatchAudiosheetShortcutIfActive('deleteSelectedCue')) {
        return true;
    }

    const script = useScriptStore.getState();
    const editor = useEditorStore.getState();

    const paths =
        editor.selectedNodePaths.length > 0
            ? editor.selectedNodePaths
            : (script.selectedNodePath
                ? [script.selectedNodePath]
                : []);

    if (paths.length > 0) {
        editor.requestDelete(paths, 'keyboard');
        return true;
    }

    return false;
}

function toggleBreakpointAtSelection(): boolean {
    const { activeFile } = useProjectStore.getState();
    if (!activeFile) return false;

    const selectedPath = useEditorStore.getState().selectedNodePaths[0];
    if (!selectedPath || selectedPath.length !== 1 || typeof selectedPath[0] !== 'number') {
        return false;
    }

    useEditorStore.getState().toggleBreakpoint(activeFile, selectedPath[0]);
    return true;
}


