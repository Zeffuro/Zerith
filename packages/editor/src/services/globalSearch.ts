import type { CharacterDefinition, ItemManifestEntry, Script } from 'core';

import type { PluginNode } from '../plugins/types';
import type { ScriptPath } from '../utils/scriptPathUtilities';

import { getPlugin } from '../plugins/commandPlugins';
import { useProjectStore } from '../store/useProjectStore';

export type GlobalSearchKind = 'character' | 'item' | 'macro' | 'scene';

export type GlobalSearchMatch = {
    filePath: string;
    kind: GlobalSearchKind;
    label: string;
    matchedValue: string;
    path: ScriptPath | undefined;
    preview: string;
    replaceable: boolean;
    valuePath: ScriptPath | undefined;
};

export type GlobalSearchProjectData = {
    characters: Record<string, CharacterDefinition>;
    items: Record<string, ItemManifestEntry>;
    macros: Record<string, Script>;
    manifest: unknown;
    projectPath: string | undefined;
    scenes: Record<string, Script>;
};

type ScanBranchOptions = {
    basePath: ScriptPath;
    filePath: string;
    kind: 'macro' | 'scene';
    label: string;
    nodes: PluginNode[];
    query: string;
};

type ScanLeafOptions = {
    basePath: ScriptPath;
    filePath: string;
    kind: GlobalSearchKind;
    label: string;
    navigationPath: ScriptPath | undefined;
    query: string;
    value: unknown;
};

type ScanRecordOptions = {
    filePath: string;
    kind: 'character' | 'item';
    labelPrefix: string;
    query: string;
    values: Record<string, CharacterDefinition | ItemManifestEntry>;
};

type ScanScriptOptions = {
    filePath: string;
    kind: 'macro' | 'scene';
    label: string;
    query: string;
    rootPath: ScriptPath;
    script: Script;
};

export function searchProjectContent(
    query: string,
    projectData: GlobalSearchProjectData = useProjectStore.getState()
): GlobalSearchMatch[] {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    const { characters, items, macros, manifest, projectPath, scenes } = projectData;
    if (!projectPath) return [];

    const matches: GlobalSearchMatch[] = [];

    const manifestRecord = toRecord(manifest);
    const scenesEntry = toRecord(manifestRecord.scenes);
    for (const [sceneName, sceneScript] of Object.entries(scenes)) {
        if (!Array.isArray(sceneScript)) continue;

        const sceneLocation = resolveSceneLocation(projectPath, sceneName, scenesEntry);
        if (!sceneLocation) continue;

        scanScriptNodes(matches, {
            filePath: sceneLocation.filePath,
            kind: 'scene',
            label: sceneLocation.label,
            query: normalizedQuery,
            rootPath: [],
            script: sceneScript,
        });
    }

    const macroSource = manifestRecord.macros;
    const macroFilePath = resolveFilePath(projectPath, typeof macroSource === 'string' ? macroSource : undefined);
    const macroNames = Object.keys(macros).toSorted((a, b) => a.localeCompare(b));
    for (const [macroIndex, macroName] of macroNames.entries()) {
        const macroScript = macros[macroName];
        if (!Array.isArray(macroScript)) continue;

        scanScriptNodes(matches, {
            filePath: macroFilePath,
            kind: 'macro',
            label: `Macro: ${macroName}`,
            query: normalizedQuery,
            rootPath: [macroIndex, 'body'],
            script: macroScript,
        });
    }

    const charactersSource = manifestRecord.characters;
    const charactersPath = resolveFilePath(projectPath, typeof charactersSource === 'string' ? charactersSource : undefined);
    scanRecordStringLeaves(matches, {
        filePath: charactersPath,
        kind: 'character',
        labelPrefix: 'Character',
        query: normalizedQuery,
        values: characters,
    });

    const itemsSource = manifestRecord.items;
    const itemsPath = resolveFilePath(projectPath, typeof itemsSource === 'string' ? itemsSource : undefined);
    scanRecordStringLeaves(matches, {
        filePath: itemsPath,
        kind: 'item',
        labelPrefix: 'Item',
        query: normalizedQuery,
        values: items,
    });

    return matches;
}

function resolveFilePath(projectPath: string, manifestPath: string | undefined): string {
    if (!manifestPath) return `${projectPath}/game.json`;
    if (manifestPath.startsWith('/') || manifestPath.startsWith('\\')) {
        return `${projectPath}${manifestPath}`;
    }
    return `${projectPath}/${manifestPath}`;
}

function resolveSceneLocation(
    projectPath: string,
    sceneName: string,
    manifestScenes: Record<string, unknown>
): { filePath: string; label: string } | undefined {
    if (!(sceneName in manifestScenes)) return;

    const source = manifestScenes[sceneName];
    if (typeof source === 'string') {
        return {
            filePath: resolveFilePath(projectPath, source),
            label: `Scene: ${sceneName}`,
        };
    }

    return {
        filePath: `${projectPath}/game.json`,
        label: `Scene: ${sceneName} (inline)`,
    };
}

function scanBranchNodes(matches: GlobalSearchMatch[], options: ScanBranchOptions): void {
    const nested = options.nodes as Script;
    scanScriptNodes(matches, {
        filePath: options.filePath,
        kind: options.kind,
        label: options.label,
        query: options.query,
        rootPath: options.basePath,
        script: nested,
    });
}

function scanLeafStrings(matches: GlobalSearchMatch[], options: ScanLeafOptions): void {
    if (typeof options.value === 'string') {
        const text = options.value;
        if (!text.toLowerCase().includes(options.query)) return;

        matches.push({
            filePath: options.filePath,
            kind: options.kind,
            label: options.label,
            matchedValue: text,
            path: options.navigationPath,
            preview: summarizeMatchedText(text, options.query),
            replaceable: true,
            valuePath: options.basePath,
        });
        return;
    }

    if (Array.isArray(options.value)) {
        for (const [index, value] of options.value.entries()) {
            scanLeafStrings(matches, {
                ...options,
                basePath: [...options.basePath, index],
                value,
            });
        }
        return;
    }

    if (!options.value || typeof options.value !== 'object') {
        return;
    }

    for (const [key, value] of Object.entries(options.value as Record<string, unknown>)) {
        scanLeafStrings(matches, {
            ...options,
            basePath: [...options.basePath, key],
            value,
        });
    }
}

function scanRecordStringLeaves(matches: GlobalSearchMatch[], options: ScanRecordOptions): void {
    for (const [entryName, value] of Object.entries(options.values)) {
        scanLeafStrings(matches, {
            basePath: [entryName],
            filePath: options.filePath,
            kind: options.kind,
            label: `${options.labelPrefix}: ${entryName}`,
            navigationPath: [entryName],
            query: options.query,
            value,
        });
    }
}

function scanScriptNodes(matches: GlobalSearchMatch[], options: ScanScriptOptions): void {
    for (const [index, node] of options.script.entries()) {
        const nodePath = [...options.rootPath, index];

        scanLeafStrings(matches, {
            basePath: nodePath,
            filePath: options.filePath,
            kind: options.kind,
            label: options.label,
            navigationPath: nodePath,
            query: options.query,
            value: node,
        });

        const branches = getPlugin(node.type).getBranches?.(node as never) ?? [];
        for (const branch of branches) {
            scanBranchNodes(matches, {
                basePath: [...nodePath, ...branch.path],
                filePath: options.filePath,
                kind: options.kind,
                label: `${options.label} > ${branch.label}`,
                nodes: branch.nodes,
                query: options.query,
            });
        }
    }
}

function summarizeMatchedText(value: string, query: string): string {
    if (value.length <= 140) return value;

    const at = value.toLowerCase().indexOf(query);
    if (at === -1) return `${value.slice(0, 137)}...`;

    const start = Math.max(0, at - 40);
    const end = Math.min(value.length, at + query.length + 60);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < value.length ? '...' : '';
    return `${prefix}${value.slice(start, end)}${suffix}`;
}

function toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
}



