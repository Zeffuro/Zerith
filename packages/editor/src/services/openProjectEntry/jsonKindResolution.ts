import type { GameManifest } from 'zerith-core';

import type { JsonHintKind } from './contracts';

import { isRecord, toRecord } from '../../utils/typeGuards';
import { isEngineConfigFilePath, isManifestFilePath, normalizeFilePath, toProjectRelativePath } from './pathHelpers';

export function resolveJsonKindFromManifest(
    fullPath: string,
    manifest: GameManifest | undefined,
    projectPath: string | undefined,
): JsonHintKind {
    const normalizedPath = normalizeFilePath(fullPath);

    if (isManifestFilePath(normalizedPath)) return 'manifest';
    if (isEngineConfigFilePath(normalizedPath)) return 'engineConfig';
    if (!manifest || !projectPath) return;

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
    if (!isRecord(scenes)) return;

    for (const sceneValue of Object.values(scenes)) {
        const scenePath = toManifestPath(sceneValue);
        if (!scenePath) continue;
        if (normalizedPath.endsWith(scenePath) || relativePath === scenePath) {
            return 'script';
        }
    }

    return;
}

export function resolveJsonKindFromSchema(data: unknown): JsonHintKind {
    const schema = toRecord(data).$schema;
    if (schema === 'zerith/manifest') return 'manifest';
    if (schema === 'zerith/characters') return 'characters';
    if (schema === 'zerith/engine-config') return 'engineConfig';
    if (schema === 'zerith/items') return 'items';
    if (schema === 'zerith/macros') return 'macros';
    if (schema === 'zerith/scene') return 'script';
    return;
}

function toManifestPath(value: unknown): string | undefined {
    if (typeof value !== 'string') return;
    return normalizeFilePath(value);
}

