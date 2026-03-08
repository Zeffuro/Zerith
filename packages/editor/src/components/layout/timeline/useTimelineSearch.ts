import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ScriptPath } from '../../../utils/scriptPathUtils';

import { getPlugin } from '../../../plugins/commandPlugins';
import { useEditorStore } from '../../../store/useEditorStore';
import { useScriptStore } from '../../../store/useScriptStore';

export function useTimelineSearch(rootNodes: any[], typeFilter: string) {
    const [query, setQuery] = useState('');
    const [activeMatchIndex, setActiveMatchIndex] = useState(0);

    const isSearching = query.trim().length > 0;

    const visibleRoot = useMemo(
        () =>
            rootNodes
                .map((node, index) => ({ index, node }))
                .filter(({ node }) => {
                    const passType = typeFilter === 'all' || node?.type === typeFilter;
                    const passQuery = nodeOrDescendantMatches(node, query);
                    return passType && passQuery;
                }),
        [rootNodes, query, typeFilter]
    );

    const matchPaths = useMemo(() => {
        const q = query.trim();
        if (!q) return [] as ScriptPath[];

        const out: ScriptPath[] = [];
        for (const { index, node } of visibleRoot) {
            collectMatchingPaths(node, [index], q, out);
        }
        return out;
    }, [visibleRoot, query]);

    const matchCount = matchPaths.length;
    const clampedMatchIndex = matchCount === 0 ? 0 : Math.min(activeMatchIndex, matchCount - 1);
    const activeMatchPath = matchCount === 0 ? null : matchPaths[clampedMatchIndex];
    const activeMatchDisplayIndex = matchCount === 0 ? 0 : clampedMatchIndex + 1;

    const [prevQuery, setPrevQuery] = useState(query);
    const [prevTypeFilter, setPrevTypeFilter] = useState(typeFilter);

    if (query !== prevQuery || typeFilter !== prevTypeFilter) {
        setPrevQuery(query);
        setPrevTypeFilter(typeFilter);
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
        const onKeyDown = (e: KeyboardEvent) => {
            if (matchCount === 0) return;
            const isModuleG = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g';
            if (!isModuleG) return;

            e.preventDefault();
            if (e.shiftKey) goToPreviousMatch();
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

function collectMatchingPaths(node: any, nodePath: ScriptPath, query: string, out: ScriptPath[]) {
    if (matchesNodeSelf(node, query)) out.push(nodePath);

    const plugin = getPlugin(node?.type || '');
    const branches = plugin.getBranches?.(node) ?? [];
    for (const branch of branches) {
        const branchArrayPath = [...nodePath, ...branch.path];
        for (let index = 0; index < (branch.nodes ?? []).length; index++) {
            collectMatchingPaths(branch.nodes[index], [...branchArrayPath, index], query, out);
        }
    }
}

function matchesNodeSelf(node: any, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return nodeSearchText(node).includes(q);
}

function nodeOrDescendantMatches(node: any, query: string): boolean {
    if (!query.trim()) return true;
    if (!node || typeof node !== 'object') return false;

    if (matchesNodeSelf(node, query)) return true;

    const plugin = getPlugin(node.type || '');
    const branches = plugin.getBranches?.(node) ?? [];

    for (const branch of branches) {
        for (const child of branch.nodes ?? []) {
            if (nodeOrDescendantMatches(child, query)) return true;
        }
    }

    return false;
}

function nodeSearchText(node: any): string {
    if (!node || typeof node !== 'object') return '';
    return [
        node.type,
        node.text,
        node.name,
        node.assetUrl,
        node.label,
        node.to,
        node.scene,
        node.id,
        node.key,
    ]
        .filter((v) => typeof v === 'string' || typeof v === 'number')
        .join(' ')
        .toLowerCase();
}