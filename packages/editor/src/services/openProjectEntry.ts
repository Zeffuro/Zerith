import type { GameManifest } from 'core';

import { executeConsoleMessageAction } from '../store/actions/consoleMessageActions';
import { getCurrentProjectPath } from '../store/actions/projectTreeActions';
import {
    executeWorkbenchOpenAction,
    getPreferredCharactersView,
    getPreferredItemsView,
    getPreferredMacrosView,
    getPreferredManifestView,
    getPreferredScriptView,
} from '../store/actions/workbenchOpenActions';
import { useProjectStore } from '../store/useProjectStore';
import { makeTabId } from '../store/useWorkbenchStore';
import { AUDIO_EXT, getExtension, IMG_EXT, TEXT_EXT } from '../utils/assetTypes';
import { fsReadTextFile } from './fs';
import { applyAssetSelection, applyMacrosFile, applyScriptFile, looksLikeMacrosObject } from './projectOpeners';

export async function openProjectEntry(fullPath: string, entryName: string, options?: { forceView?: 'json' | 'timeline' }) {
    const extension = getExtension(entryName);

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

            const { manifest, projectPath } = useProjectStore.getState();
            const kindFromSchema = resolveJsonKindFromSchema(data);
            const kindFromManifest = kindFromSchema ?? resolveJsonKindFromManifest(fullPath, manifest, projectPath);

            if (kindFromManifest === 'manifest' || kindFromManifest === 'items' || kindFromManifest === 'characters') {
                const preferredView = getPreferredViewForJsonResource(kindFromManifest, options?.forceView);
                const viewAction = getViewActionForJsonResource(kindFromManifest);

                if (options?.forceView) {
                    executeWorkbenchOpenAction({ action: viewAction, view: options.forceView });
                }

                executeWorkbenchOpenAction({ action: 'openTab', tab: {
                    id: makeTabId(kindFromManifest, fullPath),
                    kind: kindFromManifest,
                    path: fullPath,
                    preferredView,
                    textContent: contents,
                    title: kindFromManifest === 'manifest' ? 'Project Settings' : basename(fullPath),
                }});
                return;
            }

            if (kindFromManifest === 'script') {
                if (!Array.isArray(data)) {
                    throw new TypeError('Scene scripts must be JSON arrays.');
                }
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

            if (kindFromManifest === 'macros') {
                if (!looksLikeMacrosObject(data)) {
                    throw new TypeError('Macros file must be a JSON object of command arrays.');
                }
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
            const preferredView = kind === 'manifest' ? getPreferredManifestView(options?.forceView) : undefined;
            if (kind === 'manifest' && options?.forceView) {
                executeWorkbenchOpenAction({ action: 'setManifestView', view: options.forceView });
            }
            executeWorkbenchOpenAction({ action: 'openTab', tab: {
                id: makeTabId(kind, fullPath),
                kind,
                path: fullPath,
                preferredView,
                textContent: contents,
                title: kind === 'manifest' ? 'Project Settings' : basename(fullPath),
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


function focusMainEditorFor(kind: 'asset' | 'scriptLike' | 'text') {
    // TODO: integrate with Dock model to select center tabset tab.
    void kind;
}

function getPreferredViewForJsonResource(kind: 'characters' | 'items' | 'manifest', fallback: 'json' | 'timeline' | undefined) {
    if (kind === 'manifest') return getPreferredManifestView(fallback);
    if (kind === 'items') return getPreferredItemsView(fallback);
    return getPreferredCharactersView(fallback);
}

function getViewActionForJsonResource(kind: 'characters' | 'items' | 'manifest') {
    if (kind === 'manifest') return 'setManifestView' as const;
    if (kind === 'items') return 'setItemsView' as const;
    return 'setCharactersView' as const;
}

function resolveJsonKindFromSchema(data: unknown): 'characters' | 'items' | 'macros' | 'manifest' | undefined {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;

    const schema = (data as { $schema?: unknown }).$schema;
    if (schema === 'zerith/manifest') return 'manifest';
    if (schema === 'zerith/characters') return 'characters';
    if (schema === 'zerith/items') return 'items';
    if (schema === 'zerith/macros') return 'macros';
    return undefined;
}

function normalizePath(path: string): string {
    return path.replaceAll('\\', '/');
}

function resolveJsonKindFromManifest(
    fullPath: string,
    manifest: GameManifest | undefined,
    projectPath: string | undefined
): 'characters' | 'items' | 'macros' | 'manifest' | 'script' | undefined {
    const normalizedPath = normalizePath(fullPath);

    if (normalizedPath.endsWith('game.json')) return 'manifest';
    if (!manifest || !projectPath) return undefined;

    const normalizedProjectPath = normalizePath(projectPath).replace(/\/+$/, '');
    const relativePath = toProjectRelativePath(normalizedPath, normalizedProjectPath);

    const charactersPath = toManifestPath(manifest.characters);
    if (charactersPath && normalizedPath.endsWith(charactersPath)) return 'characters';
    if (charactersPath && relativePath === charactersPath) return 'characters';

    const itemsPath = toManifestPath(manifest.items);
    if (itemsPath && normalizedPath.endsWith(itemsPath)) return 'items';
    if (itemsPath && relativePath === itemsPath) return 'items';

    const macrosPath = toManifestPath(manifest.macros);
    if (macrosPath && normalizedPath.endsWith(macrosPath)) return 'macros';
    if (macrosPath && relativePath === macrosPath) return 'macros';

    const scenes = manifest.scenes;
    if (!scenes || typeof scenes !== 'object' || Array.isArray(scenes)) return undefined;

    for (const sceneValue of Object.values(scenes as Record<string, unknown>)) {
        const scenePath = toManifestPath(sceneValue);
        if (!scenePath) continue;
        if (normalizedPath.endsWith(scenePath) || relativePath === scenePath) {
            return 'script';
        }
    }

    return undefined;
}

function toManifestPath(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    return value.replaceAll('\\', '/');
}

function toProjectRelativePath(fullPath: string, projectPath: string | undefined) {
    if (!projectPath) return fullPath;
    const base = projectPath.replaceAll('\\', '/').replace(/\/+$/, '');
    const abs = fullPath.replaceAll('\\', '/');
    if (!abs.startsWith(base)) return fullPath;
    const rest = abs.slice(base.length);
    return rest.startsWith('/') ? rest : `/${rest}`;
}

