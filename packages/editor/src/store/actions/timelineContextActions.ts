import { createDefaultCommand } from '../../plugins/commandPlugins';
import { useEditorStore } from '../useEditorStore';
import { useScriptStore } from '../useScriptStore';
import type { ScriptPath } from '../../utils/scriptPathUtils';

export type TimelineContextAction =
    | 'copy'
    | 'paste'
    | 'duplicate'
    | 'delete'
    | 'playFrom'
    | 'addAfter';

export interface ExecuteTimelineContextActionOptions {
    action: TimelineContextAction;
    path: ScriptPath;
    requestDelete: (paths: ScriptPath[], source?: 'keyboard' | 'click') => void;
    triggerPlayFrom: (index: number) => void;
}

export function executeTimelineContextAction(options: ExecuteTimelineContextActionOptions): void {
    const { action, path, requestDelete, triggerPlayFrom } = options;

    const scriptState = useScriptStore.getState();
    const editorState = useEditorStore.getState();

    switch (action) {
        case 'copy': {
            const node = scriptState.getNodeAtPath(path);
            if (node !== undefined) {
                editorState.setClipboardNode(
                    typeof structuredClone === 'function'
                        ? structuredClone(node)
                        : JSON.parse(JSON.stringify(node))
                );
            }
            break;
        }

        case 'paste': {
            const clip = editorState.clipboardNode;
            if (!clip) break;
            scriptState.pasteNodeAtPath(path, clip);
            break;
        }

        case 'duplicate': {
            scriptState.duplicateNodeByPath(path);
            break;
        }

        case 'delete': {
            requestDelete([path], 'click');
            break;
        }

        case 'playFrom': {
            if (path.length === 1 && typeof path[0] === 'number') {
                triggerPlayFrom(path[0]);
            }
            break;
        }

        case 'addAfter': {
            const parent = path.slice(0, -1);
            const idx = path[path.length - 1];
            if (typeof idx !== 'number') break;
            const newNode = createDefaultCommand('dialogue');
            scriptState.addNodeAtPath(parent, newNode, idx + 1);
            break;
        }
    }
}

