import { deepClone } from 'core';

import type { EditorNode } from '../../types/EditorNode';
import type { ScriptPath } from '../../utils/scriptPathUtilities';

import { createDefaultCommand } from '../../plugins/commandPlugins';
import { useScriptStore } from '../storeBootstrap';
import { useEditorStore } from '../useEditorStore';

export interface ExecuteTimelineContextActionOptions {
    action: TimelineContextAction;
    path: ScriptPath;
    requestDelete: (paths: ScriptPath[], source?: 'click' | 'keyboard') => void;
    triggerPlayFrom: (index: number) => void;
}

export type TimelineContextAction =
    | 'addAfter'
    | 'copy'
    | 'delete'
    | 'duplicate'
    | 'paste'
    | 'playFrom';

export function executeTimelineContextAction(options: ExecuteTimelineContextActionOptions): void {
    const { action, path, requestDelete, triggerPlayFrom } = options;

    const scriptState = useScriptStore.getState();
    const editorState = useEditorStore.getState();

    switch (action) {
        case 'addAfter': {
            const parent = path.slice(0, -1);
            const index = path.at(-1);
            if (typeof index !== 'number') break;
            const newNode = createDefaultCommand('dialogue');
            scriptState.addNodeAtPath(parent, newNode, index + 1);
            break;
        }

        case 'copy': {
            const node = scriptState.getNodeAtPath(path);
            if (node !== undefined) {
                editorState.setClipboardNode(deepClone(node));
            }
            break;
        }

        case 'delete': {
            requestDelete([path], 'click');
            break;
        }

        case 'duplicate': {
            scriptState.duplicateNodeByPath(path);
            break;
        }

        case 'paste': {
            const clip = editorState.clipboardNode;
            if (!clip) break;
            scriptState.pasteNodeAtPath(path, clip as EditorNode);
            break;
        }

        case 'playFrom': {
            if (path.length === 1 && typeof path[0] === 'number') {
                triggerPlayFrom(path[0]);
            }
            break;
        }
    }
}


