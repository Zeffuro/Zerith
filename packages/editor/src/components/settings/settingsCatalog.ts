export type SettingsCategoryNode = {
    children?: SettingsCategoryNode[];
    id: string;
    label: string;
};

export const settingsCatalog: SettingsCategoryNode[] = [
    {
        children: [
            { id: 'general-playback', label: 'Playback' },
            { id: 'general-autosave', label: 'Autosave' },
            { id: 'general-layout', label: 'Layout' },
            { id: 'general-quickbuttons', label: 'Quick Buttons' },
        ],
        id: 'general',
        label: 'General',
    },
    {
        children: [
            { id: 'appearance-theme', label: 'Theme' },
            { id: 'appearance-scale', label: 'UI Scale' },
        ],
        id: 'appearance',
        label: 'Appearance',
    },
    {
        children: [
            { id: 'editor-behavior', label: 'Behavior' },
            { id: 'editor-monaco', label: 'Code Editor' },
        ],
        id: 'editor',
        label: 'Editor',
    },
    { id: 'keymap', label: 'Keymap' },
] as const;

export function buildSettingsLeafCountMap(nodes: readonly SettingsCategoryNode[]): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const node of nodes) {
        assignLeafCounts(node, counts);
    }

    return counts;
}

export function buildSettingsNodeCountMap(
    nodes: readonly SettingsCategoryNode[],
    leafCounts: Readonly<Record<string, number>>,
): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const node of nodes) {
        assignNodeCounts(node, counts, leafCounts);
    }

    return counts;
}

export function buildSettingsTreeForMatchedIds(
    nodes: readonly SettingsCategoryNode[],
    matchedIds: ReadonlySet<string>,
): SettingsCategoryNode[] {
    return nodes
        .map((node) => selectMatchedNode(node, matchedIds))
        .filter((node): node is SettingsCategoryNode => node !== undefined);
}

export function collectNodeIds(nodes: readonly SettingsCategoryNode[]): string[] {
    const ids: string[] = [];

    for (const node of nodes) {
        ids.push(node.id);
        if (node.children?.length) {
            ids.push(...collectNodeIds(node.children));
        }
    }

    return ids;
}

export function containsNodeId(nodes: readonly SettingsCategoryNode[], targetId: string): boolean {
    for (const node of nodes) {
        if (node.id === targetId) return true;
        if (node.children && containsNodeId(node.children, targetId)) return true;
    }

    return false;
}

export function filterSettingsTree(nodes: readonly SettingsCategoryNode[], rawQuery: string): SettingsCategoryNode[] {
    const query = rawQuery.trim().toLowerCase();
    if (query.length === 0) return nodes.map((node) => cloneNode(node));

    return nodes
        .map((node) => filterNode(node, query))
        .filter((node): node is SettingsCategoryNode => node !== undefined);
}

export function getFirstNodeId(nodes: readonly SettingsCategoryNode[]): string | undefined {
    const firstNode = nodes[0];
    if (!firstNode) return;
    if (firstNode.id) return firstNode.id;
    if (!firstNode.children?.length) return;
    return getFirstNodeId(firstNode.children);
}

function assignLeafCounts(node: SettingsCategoryNode, counts: Record<string, number>): number {
    if (!node.children?.length) {
        counts[node.id] = 1;
        return 1;
    }

    const total = node.children
        .map((child) => assignLeafCounts(child, counts))
        .reduce((sum, value) => sum + value, 0);

    counts[node.id] = total;
    return total;
}

function assignNodeCounts(
    node: SettingsCategoryNode,
    counts: Record<string, number>,
    leafCounts: Readonly<Record<string, number>>,
): number {
    if (!node.children?.length) {
        const value = leafCounts[node.id] ?? 0;
        counts[node.id] = value;
        return value;
    }

    const total = node.children
        .map((child) => assignNodeCounts(child, counts, leafCounts))
        .reduce((sum, value) => sum + value, 0);

    counts[node.id] = total;
    return total;
}

function cloneNode(node: SettingsCategoryNode): SettingsCategoryNode {
    return {
        ...node,
        children: node.children?.map((child) => cloneNode(child)),
    };
}

function cloneSettingsNode(node: SettingsCategoryNode): SettingsCategoryNode {
    return {
        ...node,
        children: node.children?.map((child) => cloneSettingsNode(child)),
    };
}

function filterNode(node: SettingsCategoryNode, query: string): SettingsCategoryNode | undefined {
    const matchesSelf = node.label.toLowerCase().includes(query);
    const filteredChildren = node.children
        ?.map((child) => filterNode(child, query))
        .filter((child): child is SettingsCategoryNode => child !== undefined);

    if (!matchesSelf && (!filteredChildren || filteredChildren.length === 0)) {
        return;
    }

    return {
        ...node,
        children: filteredChildren,
    };
}

function selectMatchedNode(
    node: SettingsCategoryNode,
    matchedIds: ReadonlySet<string>,
): SettingsCategoryNode | undefined {
    if (matchedIds.has(node.id)) {
        return cloneSettingsNode(node);
    }

    const children = node.children
        ?.map((child) => selectMatchedNode(child, matchedIds))
        .filter((child): child is SettingsCategoryNode => child !== undefined);

    if (!children || children.length === 0) return;
    return {
        ...node,
        children,
    };
}

