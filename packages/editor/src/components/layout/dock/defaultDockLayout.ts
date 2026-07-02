import type { IJsonModel } from 'flexlayout-react';

import { deepClone } from '@zeffuro/zerith-core';

import { DOCK_PANELS } from './dockPanelIds';

export const DOCK_LAYOUT_VERSION = 12 as const;

export const DEFAULT_DOCK_LAYOUT = {
    global: { splitterSize: 4, tabEnableClose: false },
    layout: {
        children:[
            {
                children:[
                    { component: 'explorer', id: 'explorer', name: 'Explorer', type: 'tab' },
                    { component: 'git', id: 'git', name: 'Git', type: 'tab' }
                ],
                type: 'tabset',
                weight: 20,
            },
            {
                children:[
                    {
                        children:[
                            {
                                children:[
                                    { component: 'editor', id: 'editor', name: 'Editor', type: 'tab' }
                                ],
                                type: 'tabset',
                                weight: 65,
                            },
                            {
                                children:[
                                    {
                                        children:[{ component: 'preview', id: 'preview', name: 'Preview', type: 'tab' }],
                                        type: 'tabset',
                                        weight: 45,
                                    },
                                    {
                                        children:[
                                            { component: 'inspector', id: 'inspector', name: 'Inspector', type: 'tab' },
                                            { component: 'asset_dependencies', id: 'asset_dependencies', name: 'Assets', type: 'tab' },
                                            { component: 'reference_tracker', id: 'reference_tracker', name: 'References', type: 'tab' },
                                            { component: 'runtime_monitor', id: 'runtime_monitor', name: 'Runtime', type: 'tab' },
                                            { component: 'state_observer', id: 'state_observer', name: 'State', type: 'tab' },
                                        ],
                                        type: 'tabset',
                                        weight: 55,
                                    },
                                ],
                                type: 'row',
                                weight: 35,
                            },
                        ],
                        type: 'row',
                        weight: 75,
                    },
                    {
                        children:[
                            { component: 'console', id: 'console', name: 'Console', type: 'tab' },
                            { component: 'project_validation', id: 'project_validation', name: 'Validation', type: 'tab' },
                            { component: 'global_search', id: 'global_search', name: 'Search', type: 'tab' }
                    ],
                    type: 'tabset',
                    weight: 25,
                }
            ],
                type: 'row',
                weight: 80,
            }
        ],
        type: 'row',
        weight: 100,
    },
};

export function createDefaultDockLayout() {
    return deepClone(DEFAULT_DOCK_LAYOUT);
}

export function isUsableDockLayoutJson(value: unknown): value is IJsonModel {
    if (!isRecord(value) || !isRecord(value.global) || !isRecord(value.layout)) {
        return false;
    }

    const rootChildren = value.layout.children;
    if (!Array.isArray(rootChildren) || rootChildren.length === 0) {
        return false;
    }

    const components = new Set<string>();
    const validation = collectDockComponents(value.layout, components);
    return validation.valid && components.has(DOCK_PANELS.explorer) && components.has(DOCK_PANELS.editor);
}

export function normalizeDockLayoutJsonForFlexLayout(value: unknown): IJsonModel | undefined {
    const normalized = normalizeLegacyDockNode(value);
    return isUsableDockLayoutJson(normalized) ? normalized : undefined;
}

function collectDockComponents(node: unknown, components: Set<string>): { valid: boolean } {
    if (!isRecord(node)) return { valid: false };

    if (typeof node.type === 'string' && !['border', 'row', 'tab', 'tabset'].includes(node.type)) {
        return { valid: false };
    }

    if (typeof node.component === 'string') {
        components.add(node.component);
    }

    if (!Array.isArray(node.children)) return { valid: true };
    for (const child of node.children) {
        const validation = collectDockComponents(child, components);
        if (!validation.valid) return validation;
    }

    return { valid: true };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object';
}

function normalizeLegacyDockNode(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((child) => normalizeLegacyDockNode(child));
    }

    if (!isRecord(value)) {
        return value;
    }

    const normalized: Record<string, unknown> = {};
    for (const [key, childValue] of Object.entries(value)) {
        normalized[key] = key === 'type' && childValue === 'column'
            ? 'row'
            : normalizeLegacyDockNode(childValue);
    }

    return normalized;
}
