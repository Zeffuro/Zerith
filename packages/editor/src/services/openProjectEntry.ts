import { makeTabId } from '../store/useWorkbenchStore';
import { applyAssetSelection, applyMacrosFile, applyScriptFile, looksLikeMacrosObject } from './projectOpeners';
import { fsReadTextFile } from './fs';
import { executeConsoleMessageAction } from '../store/actions/consoleMessageActions';
import {
    executeWorkbenchOpenAction,
    getPreferredMacrosView,
    getPreferredScriptView,
} from '../store/actions/workbenchOpenActions';
import { getCurrentProjectPath } from '../store/actions/projectTreeActions';

const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);
const AUDIO_EXT = new Set(['.mp3', '.ogg', '.wav', '.m4a']);
const TEXT_EXT = new Set([
    '.txt', '.md', '.yaml', '.yml', '.toml', '.ini', '.csv',
    '.ts', '.tsx', '.js', '.jsx', '.css', '.html'
]);

function extOf(name: string) {
    const i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(i).toLowerCase() : '';
}

function basename(path: string) {
    return path.split(/[\\/]/).pop() || path;
}

function toProjectRelativePath(fullPath: string, projectPath: string | null) {
    if (!projectPath) return fullPath;
    const base = projectPath.replace(/\\/g, '/').replace(/\/+$/, '');
    const abs = fullPath.replace(/\\/g, '/');
    if (!abs.startsWith(base)) return fullPath;
    const rest = abs.slice(base.length);
    return rest.startsWith('/') ? rest : `/${rest}`;
}

function focusMainEditorFor(kind: 'asset' | 'scriptLike' | 'text') {
    // TODO: integrate with Dock model to select center tabset tab.
    void kind;
}

export async function openProjectEntry(fullPath: string, entryName: string, opts?: { forceView?: 'timeline' | 'json' }) {
    const ext = extOf(entryName);

    try {
        if (IMG_EXT.has(ext) || AUDIO_EXT.has(ext)) {
            const projectPath = getCurrentProjectPath();
            const rel = toProjectRelativePath(fullPath, projectPath);
            applyAssetSelection(rel);

            executeWorkbenchOpenAction({ action: 'openTab', tab: {
                id: makeTabId('asset', fullPath),
                kind: 'asset',
                path: fullPath,
                title: basename(fullPath),
                assetPath: rel,
            }});
            return;
        }

        if (ext === '.json') {
            const contents = await fsReadTextFile(fullPath);
            const data = JSON.parse(contents);

            const base = basename(fullPath).toLowerCase();

            if (base === 'game.json') {
                executeWorkbenchOpenAction({ action: 'openTab', tab: {
                    id: makeTabId('manifest', fullPath),
                    kind: 'manifest',
                    path: fullPath,
                    title: basename(fullPath),
                    textContent: contents,
                }});
                return;
            }

            if (Array.isArray(data)) {
                applyScriptFile(fullPath, data);

                const preferred = getPreferredScriptView(opts?.forceView);
                if (opts?.forceView) executeWorkbenchOpenAction({ action: 'setScriptView', view: opts.forceView });

                executeWorkbenchOpenAction({ action: 'openTab', tab: {
                    id: makeTabId('script', fullPath),
                    kind: 'script',
                    path: fullPath,
                    title: basename(fullPath),
                    preferredView: preferred,
                }});
                return;
            }

            if (looksLikeMacrosObject(data)) {
                applyMacrosFile(fullPath, data);

                const preferred = getPreferredMacrosView(opts?.forceView);
                if (opts?.forceView) executeWorkbenchOpenAction({ action: 'setMacrosView', view: opts.forceView });

                executeWorkbenchOpenAction({ action: 'openTab', tab: {
                    id: makeTabId('macros', fullPath),
                    kind: 'macros',
                    path: fullPath,
                    title: basename(fullPath),
                    preferredView: preferred,
                }});
                return;
            }

            const kind = basename(fullPath).toLowerCase() === 'game.json' ? 'manifest' : 'json';
            executeWorkbenchOpenAction({ action: 'openTab', tab: {
                id: makeTabId(kind, fullPath),
                kind,
                path: fullPath,
                title: basename(fullPath),
                textContent: contents,
            }});
            return;
        }

        if (TEXT_EXT.has(ext)) {
            const contents = await fsReadTextFile(fullPath);
            executeWorkbenchOpenAction({ action: 'openTab', tab: {
                id: makeTabId('text', fullPath),
                kind: 'text',
                path: fullPath,
                title: basename(fullPath),
                textContent: contents,
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
    } catch (err) {
        console.error('Failed to open entry:', err);
    }
}