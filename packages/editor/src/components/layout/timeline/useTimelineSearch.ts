import { useCallback, useEffect, useMemo, useState } from 'react';

import type { PluginNode } from '../../../plugins/types';
import type { ScriptPath } from '../../../utils/scriptPathUtilities';

import { getPlugin } from '../../../plugins/commandPlugins';
import { useScriptStore } from '../../../store/storeBootstrap';
import { useEditorStore } from '../../../store/useEditorStore';

type TimelineBranch = { label: string; nodes: PluginNode[]; path: ScriptPath; };

type TimelinePluginView = {
    getBranches?: (node: PluginNode) => TimelineBranch[];
};

export function useTimelineSearch(rootNodes: PluginNode[], typeFilter: string) {
    const [query, setQuery] = useState('');
    const [activeMatchIndex, setActiveMatchIndex] = useState(0);

    const isSearching = query.trim().length > 0;

    const visibleRoot = useMemo(
        () =>
            rootNodes
                .map((node, index) => ({ index, node }))
                .filter(({ node }) => {
                    const passType = typeFilter === 'all' || node.type === typeFilter;
                    const passQuery = nodeOrDescendantMatches(node, query);
                    return passType && passQuery;
                }),
        [rootNodes, query, typeFilter]
    );

    const matchPaths = useMemo(() => {
        const normalizedQuery = query.trim();
        if (!normalizedQuery) return [] as ScriptPath[];

        const matchingPaths: ScriptPath[] = [];
        for (const { index, node } of visibleRoot) {
            collectMatchingPaths(node, [index], normalizedQuery, matchingPaths);
        }
        return matchingPaths;
    }, [visibleRoot, query]);

    const matchCount = matchPaths.length;
    const clampedMatchIndex = matchCount === 0 ? 0 : Math.min(activeMatchIndex, matchCount - 1);
    const activeMatchPath = matchCount === 0 ? undefined : matchPaths[clampedMatchIndex];
    const activeMatchDisplayIndex = matchCount === 0 ? 0 : clampedMatchIndex + 1;

    const [previousQuery, setPreviousQuery] = useState(query);
    const [previousTypeFilter, setPreviousTypeFilter] = useState(typeFilter);

    if (query !== previousQuery || typeFilter !== previousTypeFilter) {
        setPreviousQuery(query);
        setPreviousTypeFilter(typeFilter);
        setActiveMatchIndex(0);
    }

    const setSelectedNodePath = useScriptStore((s) => s.setSelectedNodePath);
    const setSelectedNode = useScriptStore((s) => s.setSelectedNode);
    const setSelectedNodePaths = useEditorStore((s) => s.setSelectedNodePaths);
    const setSelectionAnchorPath = useEditorStore((s) => s.setSelectionAnchorPath);

    useEffect(() => {
        if (!activeMatchPath) return;

        setSelectedNodePath(activeMatchPath);
        setSelectedNodePaths([activeMatchPath]);
        setSelectionAnchorPath(activeMatchPath);
        if (activeMatchPath.length > 0 && typeof activeMatchPath[0] === 'number') {
            setSelectedNode(activeMatchPath[0]);
        }

        const selector = `[data-node-path="${activeMatchPath.join('.')}"]`;
        const element = document.querySelector(selector);
        if (element && 'scrollIntoView' in element) {
            (element as HTMLElement).scrollIntoView({ block: 'nearest' });
        }
    }, [activeMatchPath, setSelectedNodePath, setSelectedNode, setSelectedNodePaths, setSelectionAnchorPath]);

    const goToNextMatch = useCallback(() => {
        if (matchCount === 0) return;
        setActiveMatchIndex((previous) => (previous + 1) % matchCount);
    }, [matchCount]);

    const goToPreviousMatch = useCallback(() => {
        if (matchCount === 0) return;
        setActiveMatchIndex((previous) => (previous - 1 + matchCount) % matchCount);
    }, [matchCount]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (matchCount === 0) return;
            const isModuleG = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g';
            if (!isModuleG) return;

            event.preventDefault();
            if (event.shiftKey) goToPreviousMatch();
            else goToNextMatch();
        };

        globalThis.addEventListener('keydown', onKeyDown);
        return () => globalThis.removeEventListener('keydown', onKeyDown);
    }, [matchCount, goToNextMatch, goToPreviousMatch]);

    return {
        activeMatchDisplayIndex,
        goToNextMatch,
        goToPrevMatch: goToPreviousMatch,
        isSearching,
        matchCount,
        query,
        setQuery,
        visibleRoot,
    };
}

function collectMatchingPaths(node: PluginNode, nodePath: ScriptPath, query: string, out: ScriptPath[]) {
    if (matchesNodeSelf(node, query)) out.push(nodePath);

    const branches = getTimelineBranches(node);
    for (const branch of branches) {
        const branchArrayPath = [...nodePath, ...branch.path];
        for (let index = 0; index < branch.nodes.length; index++) {
            collectMatchingPaths(branch.nodes[index], [...branchArrayPath, index], query, out);
        }
    }
}

function getTimelineBranches(node: PluginNode): TimelineBranch[] {
    const plugin = getPlugin(node.type) as unknown as TimelinePluginView;
    return plugin.getBranches?.(node) ?? [];
}

function matchesNodeSelf(node: PluginNode, query: string): boolean {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return true;
    return nodeSearchText(node).includes(normalizedQuery);
}

function nodeOrDescendantMatches(node: PluginNode, query: string): boolean {
    if (!query.trim()) return true;

    if (matchesNodeSelf(node, query)) return true;

    const branches = getTimelineBranches(node);

    for (const branch of branches) {
        for (const child of branch.nodes) {
            if (nodeOrDescendantMatches(child, query)) return true;
        }
    }

    return false;
}

function nodeSearchText(node: PluginNode): string {
    const nodeRecord = node as Record<string, unknown>;
    return [
        node.type,
        nodeRecord.text,
        nodeRecord.name,
        nodeRecord.assetUrl,
        nodeRecord.label,
        nodeRecord.to,
        nodeRecord.scene,
        nodeRecord.id,
        nodeRecord.key,
    ]
        .filter((value) => typeof value === 'string' || typeof value === 'number')
        .join(' ')
        .toLowerCase();
}
