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

export type GlobalSearchReplacementFile = {
    content: string;
    filePath: string;
    kind: GlobalSearchKind;
};

export type GlobalSearchTextOptions = {
    caseSensitive?: boolean;
    regex?: boolean;
};

type ResolvedGlobalSearchTextOptions = {
    caseSensitive: boolean;
    regex: boolean;
};

type ScanBranchOptions = {
    basePath: ScriptPath;
    filePath: string;
    kind: 'macro' | 'scene';
    label: string;
    nodes: PluginNode[];
    query: string;
    textOptions: ResolvedGlobalSearchTextOptions;
};

type ScanLeafOptions = {
    basePath: ScriptPath;
    filePath: string;
    kind: GlobalSearchKind;
    label: string;
    navigationPath: ScriptPath | undefined;
    query: string;
    textOptions: ResolvedGlobalSearchTextOptions;
    value: unknown;
};

type ScanRecordOptions = {
    filePath: string;
    kind: 'character' | 'item';
    labelPrefix: string;
    query: string;
    textOptions: ResolvedGlobalSearchTextOptions;
    values: Record<string, CharacterDefinition | ItemManifestEntry>;
};

type ScanScriptOptions = {
    filePath: string;
    kind: 'macro' | 'scene';
    label: string;
    query: string;
    rootPath: ScriptPath;
    script: Script;
    textOptions: ResolvedGlobalSearchTextOptions;
};

export function replaceProjectContent(
    query: string,
    replacement: string,
    matches: GlobalSearchMatch[],
    projectData: GlobalSearchProjectData = useProjectStore.getState(),
    textOptions: GlobalSearchTextOptions = {},
): GlobalSearchReplacementFile[] {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return [];
    if (!projectData.projectPath) return [];

    const resolvedTextOptions = resolveGlobalSearchTextOptions(textOptions);
    if (!isSearchExpressionValid(normalizedQuery, resolvedTextOptions)) return [];

    const nextCharacters = structuredClone(projectData.characters);
    const nextItems = structuredClone(projectData.items);
    const nextMacros = structuredClone(projectData.macros);
    const nextScenes = structuredClone(projectData.scenes);

    const changedFilePaths = new Set<string>();
    const replaceableMatches = matches.filter((match) => match.replaceable && Array.isArray(match.valuePath));

    for (const match of replaceableMatches) {
        const valuePath = match.valuePath;
        if (!valuePath || valuePath.length === 0) continue;

        const changed = applyMatchReplacement({
            match,
            nextCharacters,
            nextItems,
            nextMacros,
            nextScenes,
            query: normalizedQuery,
            replacement,
            textOptions: resolvedTextOptions,
        });

        if (changed) {
            changedFilePaths.add(match.filePath);
        }
    }

    const files: GlobalSearchReplacementFile[] = [];
    for (const filePath of changedFilePaths) {
        const payload = toReplacementFilePayload(filePath, nextCharacters, nextItems, nextMacros, nextScenes, projectData);
        if (payload) files.push(payload);
    }

    return files.toSorted((a, b) => a.filePath.localeCompare(b.filePath));
}

export function searchProjectContent(
    query: string,
    projectData: GlobalSearchProjectData = useProjectStore.getState(),
    textOptions: GlobalSearchTextOptions = {},
): GlobalSearchMatch[] {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return [];

    const resolvedTextOptions = resolveGlobalSearchTextOptions(textOptions);
    if (!isSearchExpressionValid(normalizedQuery, resolvedTextOptions)) return [];

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
            textOptions: resolvedTextOptions,
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
            textOptions: resolvedTextOptions,
        });
    }

    const charactersSource = manifestRecord.characters;
    const charactersPath = resolveFilePath(projectPath, typeof charactersSource === 'string' ? charactersSource : undefined);
    scanRecordStringLeaves(matches, {
        filePath: charactersPath,
        kind: 'character',
        labelPrefix: 'Character',
        query: normalizedQuery,
        textOptions: resolvedTextOptions,
        values: characters,
    });

    const itemsSource = manifestRecord.items;
    const itemsPath = resolveFilePath(projectPath, typeof itemsSource === 'string' ? itemsSource : undefined);
    scanRecordStringLeaves(matches, {
        filePath: itemsPath,
        kind: 'item',
        labelPrefix: 'Item',
        query: normalizedQuery,
        textOptions: resolvedTextOptions,
        values: items,
    });

    return matches;
}

function applyMatchReplacement({
    match,
    nextCharacters,
    nextItems,
    nextMacros,
    nextScenes,
    query,
    replacement,
    textOptions,
}: {
    match: GlobalSearchMatch;
    nextCharacters: GlobalSearchProjectData['characters'];
    nextItems: GlobalSearchProjectData['items'];
    nextMacros: GlobalSearchProjectData['macros'];
    nextScenes: GlobalSearchProjectData['scenes'];
    query: string;
    replacement: string;
    textOptions: ResolvedGlobalSearchTextOptions;
}): boolean {
    const valuePath = match.valuePath;
    if (!valuePath) return false;

    if (match.kind === 'character') {
        const current = getAtPath(nextCharacters, valuePath);
        if (typeof current !== 'string') return false;
        const nextValue = replaceSearchValue(current, query, replacement, textOptions);
        if (nextValue === current) return false;
        setAtPath(nextCharacters, valuePath, nextValue);
        return true;
    }

    if (match.kind === 'item') {
        const current = getAtPath(nextItems, valuePath);
        if (typeof current !== 'string') return false;
        const nextValue = replaceSearchValue(current, query, replacement, textOptions);
        if (nextValue === current) return false;
        setAtPath(nextItems, valuePath, nextValue);
        return true;
    }

    if (match.kind === 'macro') {
        const macroName = toMacroName(match.label);
        if (!macroName || !Array.isArray(nextMacros[macroName])) return false;

        const macroRelativePath = toMacroRelativePath(valuePath);
        if (!macroRelativePath) return false;

        const current = getAtPath(nextMacros[macroName], macroRelativePath);
        if (typeof current !== 'string') return false;
        const nextValue = replaceSearchValue(current, query, replacement, textOptions);
        if (nextValue === current) return false;
        setAtPath(nextMacros[macroName], macroRelativePath, nextValue);
        return true;
    }

    const sceneName = toSceneName(match.label);
    if (!sceneName || !Array.isArray(nextScenes[sceneName])) return false;
    const current = getAtPath(nextScenes[sceneName], valuePath);
    if (typeof current !== 'string') return false;
    const nextValue = replaceSearchValue(current, query, replacement, textOptions);
    if (nextValue === current) return false;
    setAtPath(nextScenes[sceneName], valuePath, nextValue);
    return true;
}

function findSearchMatchStart(
    source: string,
    query: string,
    textOptions: ResolvedGlobalSearchTextOptions,
): number {
    if (!query) return -1;

    if (!textOptions.regex) {
        if (textOptions.caseSensitive) {
            return source.indexOf(query);
        }
        return source.toLowerCase().indexOf(query.toLowerCase());
    }

    const expression = toSearchExpression(query, textOptions, false);
    if (!expression) return -1;
    return source.search(expression);
}


function getAtPath(value: unknown, path: ScriptPath): unknown {
    let current: unknown = value;
    for (const segment of path) {
        if (typeof segment === 'number') {
            if (!Array.isArray(current)) return undefined;
            current = current[segment];
            continue;
        }

        if (!current || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[segment];
    }
    return current;
}

function isSearchExpressionValid(
    query: string,
    textOptions: ResolvedGlobalSearchTextOptions,
): boolean {
    return Boolean(toSearchExpression(query, textOptions, false));
}

function matchesSearchValue(
    source: string,
    query: string,
    textOptions: ResolvedGlobalSearchTextOptions,
): boolean {
    return findSearchMatchStart(source, query, textOptions) >= 0;
}

function replaceSearchValue(
    source: string,
    query: string,
    replacement: string,
    textOptions: ResolvedGlobalSearchTextOptions,
): string {
    if (!query) return source;
    const expression = toSearchExpression(query, textOptions, true);
    if (!expression) return source;
    return source.replaceAll(expression, replacement);
}

function resolveFilePath(projectPath: string, manifestPath: string | undefined): string {
    if (!manifestPath) return `${projectPath}/game.json`;
    if (manifestPath.startsWith('/') || manifestPath.startsWith('\\')) {
        return `${projectPath}${manifestPath}`;
    }
    return `${projectPath}/${manifestPath}`;
}

function resolveGlobalSearchTextOptions(
    textOptions: GlobalSearchTextOptions,
): ResolvedGlobalSearchTextOptions {
    return {
        caseSensitive: Boolean(textOptions.caseSensitive),
        regex: Boolean(textOptions.regex),
    };
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
        textOptions: options.textOptions,
    });
}

function scanLeafStrings(matches: GlobalSearchMatch[], options: ScanLeafOptions): void {
    if (typeof options.value === 'string') {
        const text = options.value;
        if (!matchesSearchValue(text, options.query, options.textOptions)) return;

        matches.push({
            filePath: options.filePath,
            kind: options.kind,
            label: options.label,
            matchedValue: text,
            path: options.navigationPath,
            preview: summarizeMatchedText(text, options.query, options.textOptions),
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
            textOptions: options.textOptions,
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
            textOptions: options.textOptions,
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
                textOptions: options.textOptions,
            });
        }
    }
}

function setAtPath(target: unknown, path: ScriptPath, value: unknown): boolean {
    if (path.length === 0) return false;

    let current: unknown = target;
    for (const [index, segment] of path.entries()) {
        const isLast = index === path.length - 1;

        if (typeof segment === 'number') {
            if (!Array.isArray(current) || segment < 0 || segment >= current.length) return false;
            if (isLast) {
                current[segment] = value;
                return true;
            }
            current = current[segment];
            continue;
        }

        if (!current || typeof current !== 'object' || Array.isArray(current)) return false;
        const currentRecord = current as Record<string, unknown>;
        if (isLast) {
            currentRecord[segment] = value;
            return true;
        }
        current = currentRecord[segment];
    }

    return false;
}

function summarizeMatchedText(
    value: string,
    query: string,
    textOptions: ResolvedGlobalSearchTextOptions,
): string {
    if (value.length <= 140) return value;

    const at = findSearchMatchStart(value, query, textOptions);
    if (at === -1) return `${value.slice(0, 137)}...`;

    const start = Math.max(0, at - 40);
    const end = Math.min(value.length, at + query.length + 60);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < value.length ? '...' : '';
    return `${prefix}${value.slice(start, end)}${suffix}`;
}

function toMacroName(label: string): string | undefined {
    const prefix = 'Macro: ';
    return label.startsWith(prefix) ? label.slice(prefix.length) : undefined;
}

function toMacroRelativePath(valuePath: ScriptPath): ScriptPath | undefined {
    if (valuePath.length < 2) return undefined;
    if (typeof valuePath[0] !== 'number') return undefined;
    if (valuePath[1] !== 'body') return undefined;
    return valuePath.slice(2);
}

function toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
}

function toReplacementFilePayload(
    filePath: string,
    nextCharacters: GlobalSearchProjectData['characters'],
    nextItems: GlobalSearchProjectData['items'],
    nextMacros: GlobalSearchProjectData['macros'],
    nextScenes: GlobalSearchProjectData['scenes'],
    projectData: GlobalSearchProjectData,
): GlobalSearchReplacementFile | undefined {
    const manifestRecord = toRecord(projectData.manifest);
    const charactersSource = manifestRecord.characters;
    const charactersFilePath = resolveFilePath(
        projectData.projectPath ?? '',
        typeof charactersSource === 'string' ? charactersSource : undefined,
    );
    if (filePath === charactersFilePath) {
        return { content: JSON.stringify(nextCharacters, undefined, 2), filePath, kind: 'character' };
    }

    const itemsSource = manifestRecord.items;
    const itemsFilePath = resolveFilePath(
        projectData.projectPath ?? '',
        typeof itemsSource === 'string' ? itemsSource : undefined,
    );
    if (filePath === itemsFilePath) {
        return { content: JSON.stringify(nextItems, undefined, 2), filePath, kind: 'item' };
    }

    const macrosSource = manifestRecord.macros;
    const macrosFilePath = resolveFilePath(
        projectData.projectPath ?? '',
        typeof macrosSource === 'string' ? macrosSource : undefined,
    );
    if (filePath === macrosFilePath) {
        return { content: JSON.stringify(nextMacros, undefined, 2), filePath, kind: 'macro' };
    }

    const sceneName = Object.keys(nextScenes).find((name) => {
        const sceneValue = toRecord(manifestRecord.scenes)[name];
        if (typeof sceneValue !== 'string') return false;
        return resolveFilePath(projectData.projectPath ?? '', sceneValue) === filePath;
    });
    if (!sceneName) return undefined;

    return {
        content: JSON.stringify(nextScenes[sceneName], undefined, 2),
        filePath,
        kind: 'scene',
    };
}

function toSceneName(label: string): string | undefined {
    const suffix = ' (inline)';
    const prefix = 'Scene: ';
    if (!label.startsWith(prefix)) return undefined;
    const raw = label.slice(prefix.length);
    if (raw.endsWith(suffix)) return undefined;
    return raw;
}

function toSearchExpression(
    query: string,
    textOptions: ResolvedGlobalSearchTextOptions,
    global: boolean,
): RegExp | undefined {
    if (!query) return undefined;

    try {
        if (textOptions.regex) {
            const flags = `${textOptions.caseSensitive ? '' : 'i'}${global ? 'g' : ''}`;
            return new RegExp(query, flags);
        }

        const escaped = query.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
        const flags = `${textOptions.caseSensitive ? '' : 'i'}${global ? 'g' : ''}`;
        return new RegExp(escaped, flags);
    } catch {
        return undefined;
    }
}



