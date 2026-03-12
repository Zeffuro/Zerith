import type { GameManifest } from 'core';

import { isRecord, toRecord } from '../utils/typeGuards';
import { isManifestFilePath, normalizeFilePath } from './openProjectEntry/pathHelpers';

type JsonResourceKind = 'characters' | 'items' | 'manifest';

type JsonManifestKind = JsonResourceKind | 'macros' | 'script';

export function resolveJsonKindFromManifest(
    fullPath: string,
    manifest: GameManifest | undefined,
    projectPath: string | undefined,
): JsonManifestKind | undefined {
    const normalizedPath = normalizeFilePath(fullPath);

    if (isManifestFilePath(normalizedPath)) return 'manifest';
    if (!manifest || !projectPath) return undefined;

    const normalizedProjectPath = normalizeFilePath(projectPath).replace(/\/+$/, '');
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
    if (!isRecord(scenes)) return undefined;

    for (const sceneValue of Object.values(scenes)) {
        const scenePath = toManifestPath(sceneValue);
        if (!scenePath) continue;
        if (normalizedPath.endsWith(scenePath) || relativePath === scenePath) {
            return 'script';
        }
    }

    return undefined;
}

export function resolveJsonKindFromSchema(data: unknown): JsonResourceKind | 'macros' | undefined {
    const schema = toRecord(data).$schema;
    if (schema === 'zerith/manifest') return 'manifest';
    if (schema === 'zerith/characters') return 'characters';
    if (schema === 'zerith/items') return 'items';
    if (schema === 'zerith/macros') return 'macros';
    return undefined;
}

function toManifestPath(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    return normalizeFilePath(value);
}

export function toProjectRelativePath(fullPath: string, projectPath: string | undefined): string {
    if (!projectPath) return fullPath;
    const base = normalizeFilePath(projectPath).replace(/\/+$/, '');
    const abs = normalizeFilePath(fullPath);
    if (!abs.startsWith(base)) return fullPath;
    const rest = abs.slice(base.length);
    return rest.startsWith('/') ? rest : `/${rest}`;
}

