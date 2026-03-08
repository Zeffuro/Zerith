import { useEffect, useMemo, useState } from 'react';
import type { ScriptPath } from '../../../utils/scriptPathUtils';
import { getPlugin } from '../../../plugins/commandPlugins';
import { useEditorStore } from '../../../store/useEditorStore';
import { useScriptStore } from '../../../store/useScriptStore';

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

function collectMatchingPaths(node: any, nodePath: ScriptPath, query: string, out: ScriptPath[]) {
    if (matchesNodeSelf(node, query)) out.push(nodePath);

    const plugin = getPlugin(node?.type || '');
    const branches = plugin.getBranches?.(node) ?? [];
    for (const branch of branches) {
        const branchArrayPath = [...nodePath, ...branch.path];
        for (let i = 0; i < (branch.nodes ?? []).length; i++) {
            collectMatchingPaths(branch.nodes[i], [...branchArrayPath, i], query, out);
        }
    }
}

export function useTimelineSearch(rootNodes: any[], typeFilter: string) {
    const [query, setQuery] = useState('');
    const [activeMatchIndex, setActiveMatchIndex] = useState(0);

    const isSearching = query.trim().length > 0;

    const visibleRoot = useMemo(
        () =>
            rootNodes
                .map((node, index) => ({ node, index }))
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
        for (const { node, index } of visibleRoot) {
            collectMatchingPaths(node, [index], q, out);
        }
        return out;
    }, [visibleRoot, query]);

    const matchCount = matchPaths.length;
    const clampedMatchIndex = matchCount === 0 ? 0 : Math.min(activeMatchIndex, matchCount - 1);
    const activeMatchPath = matchCount === 0 ? null : matchPaths[clampedMatchIndex];
    const activeMatchDisplayIndex = matchCount === 0 ? 0 : clampedMatchIndex + 1;

    useEffect(() => {
        setActiveMatchIndex(0);
    }, [query, typeFilter]);

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
            setSelectedNode(activeMatchPath[0] as number);
        }

        const selector = `[data-node-path="${activeMatchPath.join('.')}"]`;
        const el = document.querySelector(selector);
        if (el && 'scrollIntoView' in el) {
            (el as HTMLElement).scrollIntoView({ block: 'nearest' });
        }
    }, [activeMatchPath, setSelectedNodePath, setSelectedNode, setSelectedNodePaths, setSelectionAnchorPath]);

    const goToNextMatch = () => {
        if (matchCount === 0) return;
        setActiveMatchIndex((prev) => (prev + 1) % matchCount);
    };

    const goToPrevMatch = () => {
        if (matchCount === 0) return;
        setActiveMatchIndex((prev) => (prev - 1 + matchCount) % matchCount);
    };

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (matchCount === 0) return;
            const isModG = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g';
            if (!isModG) return;

            e.preventDefault();
            if (e.shiftKey) goToPrevMatch();
            else goToNextMatch();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [matchCount]);

    return {
        query,
        setQuery,
        isSearching,
        visibleRoot,
        matchCount,
        activeMatchDisplayIndex,
        goToNextMatch,
        goToPrevMatch,
    };
}