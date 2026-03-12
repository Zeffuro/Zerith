import type { CharacterDefinition, ItemManifestEntry, Script } from 'core';

import type { PluginNode } from '../../plugins/types';
import type { ScriptPath } from '../../utils/scriptPathUtilities';
import type { GlobalSearchKind, GlobalSearchMatch } from './contracts';

import { getPlugin } from '../../plugins/commandPlugins';
import { formatScriptBranchLabel } from './branchLabels';
import { formatRecordSourceLabel, type RecordLabelKind } from './recordLabels';
import {
    matchesSearchValue,
    summarizeMatchedText,
    type ResolvedGlobalSearchTextOptions,
} from './textSearch';

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
    kind: RecordLabelKind;
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

export function scanLeafStrings(matches: GlobalSearchMatch[], options: ScanLeafOptions): void {
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

export function scanRecordStringLeaves(matches: GlobalSearchMatch[], options: ScanRecordOptions): void {
    for (const [entryName, value] of Object.entries(options.values)) {
        scanLeafStrings(matches, {
            basePath: [entryName],
            filePath: options.filePath,
            kind: options.kind,
            label: formatRecordSourceLabel(options.kind, entryName),
            navigationPath: [entryName],
            query: options.query,
            textOptions: options.textOptions,
            value,
        });
    }
}

export function scanScriptNodes(matches: GlobalSearchMatch[], options: ScanScriptOptions): void {
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
                label: formatScriptBranchLabel(options.label, branch.label),
                nodes: branch.nodes,
                query: options.query,
                textOptions: options.textOptions,
            });
        }
    }
}

