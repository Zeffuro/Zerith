export const DOCK_LAYOUT_VERSION = 1 as const;

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
                            { component: 'console', id: 'console', name: 'Console', type: 'tab' }
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
    return structuredClone(DEFAULT_DOCK_LAYOUT);
}
