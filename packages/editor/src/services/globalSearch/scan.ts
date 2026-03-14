import type { CharacterDefinition, ItemManifestEntry, Script } from 'core';

import type { PluginNode } from '../../plugins/types';
import type { ScriptPath } from '../../utils/scriptPathUtilities';
import type { GlobalSearchMatch, RecordSearchKind, ScriptSearchKind } from './contracts';

import { getPlugin } from '../../plugins/commandPlugins';
import { formatScriptBranchLabel } from './branchLabels';
import { formatRecordSourceLabel } from './recordLabels';
import { scanLeafStrings } from './scanLeafStrings';
import { type ResolvedGlobalSearchTextOptions } from './textSearch';



type ScanBranchOptions = {
    basePath: ScriptPath;
    filePath: string;
    kind: ScriptSearchKind;
    label: string;
    nodes: PluginNode[];
    query: string;
    textOptions: ResolvedGlobalSearchTextOptions;
};

type ScanRecordOptions = {
    filePath: string;
    kind: RecordSearchKind;
    query: string;
    textOptions: ResolvedGlobalSearchTextOptions;
    values: Record<string, CharacterDefinition | ItemManifestEntry>;
};

type ScanScriptOptions = {
    filePath: string;
    kind: ScriptSearchKind;
    label: string;
    query: string;
    rootPath: ScriptPath;
    script: Script;
    textOptions: ResolvedGlobalSearchTextOptions;
};

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


export {scanLeafStrings} from './scanLeafStrings';