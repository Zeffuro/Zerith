import { executeConsoleMessageAction } from '../../store/actions/consoleMessageActions';
import { getCurrentProjectPath } from '../../store/actions/projectTreeActions';
import { executeWorkbenchOpenAction } from '../../store/actions/workbenchOpenActions';
import { makeTabId } from '../../store/useWorkbenchStore';
import { fsReadTextFile } from '../fs';
import { toProjectRelativePath } from '../openProjectEntryKind';
import { applyAssetSelection } from '../projectOpeners';
import { basenameFromPath } from './pathHelpers';

export function openAssetEntry(fullPath: string): void {
    const projectPath = getCurrentProjectPath();
    const relativePath = toProjectRelativePath(fullPath, projectPath);
    applyAssetSelection(relativePath);

    executeWorkbenchOpenAction({ action: 'openTab', tab: {
        assetPath: relativePath,
        id: makeTabId('asset', fullPath),
        kind: 'asset',
        path: fullPath,
        title: basenameFromPath(fullPath),
    }});
}

export async function openTextEntry(fullPath: string): Promise<void> {
    const contents = await fsReadTextFile(fullPath);
    executeWorkbenchOpenAction({ action: 'openTab', tab: {
        id: makeTabId('text', fullPath),
        kind: 'text',
        path: fullPath,
        textContent: contents,
        title: basenameFromPath(fullPath),
    }});
}

export function openUnknownEntry(fullPath: string): void {
    executeWorkbenchOpenAction({ action: 'openTab', tab: {
        id: makeTabId('unknown', fullPath),
        kind: 'unknown',
        path: fullPath,
        title: basenameFromPath(fullPath),
    }});
    executeConsoleMessageAction('editor', 'warn', 'No handler for file type yet:', fullPath);
}

