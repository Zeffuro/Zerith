import { executeConsoleMessageAction } from '../store/actions/consoleMessageActions';
import { getCurrentProjectPath } from '../store/actions/projectTreeActions';
import {
    executeWorkbenchOpenAction,
    getPreferredMacrosView,
    getPreferredScriptView,
} from '../store/actions/workbenchOpenActions';
import { makeTabId } from '../store/useWorkbenchStore';
import { fsReadTextFile } from './fs';
import { applyAssetSelection, applyMacrosFile, applyScriptFile, looksLikeMacrosObject } from './projectOpeners';

const IMG_EXT = new Set(['.avif', '.jpeg', '.jpg', '.png', '.webp']);
const AUDIO_EXT = new Set(['.m4a', '.mp3', '.ogg', '.wav']);
const TEXT_EXT = new Set([
    '.css', '.csv', '.html', '.ini', '.js', '.jsx', '.md',
    '.toml', '.ts', '.tsx', '.txt', '.yaml', '.yml'
]);

export async function openProjectEntry(fullPath: string, entryName: string, options?: { forceView?: 'json' | 'timeline' }) {
    const extension = extensionOf(entryName);

    try {
        if (IMG_EXT.has(extension) || AUDIO_EXT.has(extension)) {
            const projectPath = getCurrentProjectPath();
            const relativePath = toProjectRelativePath(fullPath, projectPath);
            applyAssetSelection(relativePath);

            executeWorkbenchOpenAction({ action: 'openTab', tab: {
                assetPath: relativePath,
                id: makeTabId('asset', fullPath),
                kind: 'asset',
                path: fullPath,
                title: basename(fullPath),
            }});
            return;
        }

        if (extension === '.json') {
            const contents = await fsReadTextFile(fullPath);
            const data: unknown = JSON.parse(contents);

            const base = basename(fullPath).toLowerCase();

            if (base === 'game.json') {
                executeWorkbenchOpenAction({ action: 'openTab', tab: {
                    id: makeTabId('manifest', fullPath),
                    kind: 'manifest',
                    path: fullPath,
                    textContent: contents,
                    title: basename(fullPath),
                }});
                return;
            }

            if (Array.isArray(data)) {
                applyScriptFile(fullPath, data);

                const preferred = getPreferredScriptView(options?.forceView);
                if (options?.forceView) executeWorkbenchOpenAction({ action: 'setScriptView', view: options.forceView });

                executeWorkbenchOpenAction({ action: 'openTab', tab: {
                    id: makeTabId('script', fullPath),
                    kind: 'script',
                    path: fullPath,
                    preferredView: preferred,
                    title: basename(fullPath),
                }});
                return;
            }

            if (looksLikeMacrosObject(data)) {
                applyMacrosFile(fullPath, data);

                const preferred = getPreferredMacrosView(options?.forceView);
                if (options?.forceView) executeWorkbenchOpenAction({ action: 'setMacrosView', view: options.forceView });

                executeWorkbenchOpenAction({ action: 'openTab', tab: {
                    id: makeTabId('macros', fullPath),
                    kind: 'macros',
                    path: fullPath,
                    preferredView: preferred,
                    title: basename(fullPath),
                }});
                return;
            }

            const kind = basename(fullPath).toLowerCase() === 'game.json' ? 'manifest' : 'json';
            executeWorkbenchOpenAction({ action: 'openTab', tab: {
                id: makeTabId(kind, fullPath),
                kind,
                path: fullPath,
                textContent: contents,
                title: basename(fullPath),
            }});
            return;
        }

        if (TEXT_EXT.has(extension)) {
            const contents = await fsReadTextFile(fullPath);
            executeWorkbenchOpenAction({ action: 'openTab', tab: {
                id: makeTabId('text', fullPath),
                kind: 'text',
                path: fullPath,
                textContent: contents,
                title: basename(fullPath),
            }});
            focusMainEditorFor('text');
            return;
        }

        executeWorkbenchOpenAction({ action: 'openTab', tab: {
            id: makeTabId('unknown', fullPath),
            kind: 'unknown',
            path: fullPath,
            title: basename(fullPath),
        }});
        executeConsoleMessageAction('editor', 'warn', 'No handler for file type yet:', fullPath);
    } catch (error) {
        console.error('Failed to open entry:', error);
    }
}

function basename(path: string) {
    return path.split(/[\\/]/).pop() || path;
}

function extensionOf(name: string) {
    const index = name.lastIndexOf('.');
    return index === -1 ? '' : name.slice(index).toLowerCase();
}

function focusMainEditorFor(kind: 'asset' | 'scriptLike' | 'text') {
    // TODO: integrate with Dock model to select center tabset tab.
    void kind;
}

function toProjectRelativePath(fullPath: string, projectPath: string | undefined) {
    if (!projectPath) return fullPath;
    const base = projectPath.replaceAll('\\', '/').replace(/\/+$/, '');
    const abs = fullPath.replaceAll('\\', '/');
    if (!abs.startsWith(base)) return fullPath;
    const rest = abs.slice(base.length);
    return rest.startsWith('/') ? rest : `/${rest}`;
}