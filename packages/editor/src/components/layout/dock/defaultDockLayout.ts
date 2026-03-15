import { deepClone } from 'core';

export const DOCK_LAYOUT_VERSION = 6 as const;

export const DEFAULT_DOCK_LAYOUT = {
    global: { splitterSize: 4, tabEnableClose: false },
    layout: {
        children:[
            {
                children:[{ component: 'explorer', id: 'explorer', name: 'Explorer', type: 'tab' }],
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
                                            { component: 'reference_tracker', id: 'reference_tracker', name: 'References', type: 'tab' },
                                            { component: 'runtime_monitor', id: 'runtime_monitor', name: 'Runtime', type: 'tab' },
                                            { component: 'audiosheet_editor', id: 'audiosheet_editor', name: 'Audiosheet', type: 'tab' },
                                            { component: 'spritesheet_editor', id: 'spritesheet_editor', name: 'Spritesheet', type: 'tab' },
                                            { component: 'state_observer', id: 'state_observer', name: 'State', type: 'tab' },
                                        ],
                                        type: 'tabset',
                                        weight: 55,
                                    },
                                ],
                                type: 'column',
                                weight: 35,
                            },
                        ],
                        type: 'row',
                        weight: 75,
                    },
                    {
                        children:[
                            { component: 'console', id: 'console', name: 'Console', type: 'tab' },
                            { component: 'global_search', id: 'global_search', name: 'Search', type: 'tab' }
                        ],
                        type: 'tabset',
                        weight: 25,
                    }
                ],
                type: 'column',
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
