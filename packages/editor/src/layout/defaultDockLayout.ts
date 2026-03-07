export const DOCK_LAYOUT_VERSION = 1 as const;

export const DEFAULT_DOCK_LAYOUT = {
    global: { tabEnableClose: false, splitterSize: 4 },
    layout: {
        type: 'row',
        weight: 100,
        children:[
            {
                type: 'tabset',
                weight: 20,
                children:[{ type: 'tab', name: 'Explorer', component: 'explorer', id: 'explorer' }],
            },
            {
                type: 'column',
                weight: 80,
                children:[
                    {
                        type: 'row',
                        weight: 75,
                        children:[
                            {
                                type: 'tabset',
                                weight: 65,
                                children:[
                                    { type: 'tab', name: 'Editor', component: 'editor', id: 'editor' }
                                ],
                            },
                            {
                                type: 'column',
                                weight: 35,
                                children:[
                                    {
                                        type: 'tabset',
                                        weight: 45,
                                        children:[{ type: 'tab', name: 'Preview', component: 'preview', id: 'preview' }],
                                    },
                                    {
                                        type: 'tabset',
                                        weight: 55,
                                        children:[
                                            { type: 'tab', name: 'Inspector', component: 'inspector', id: 'inspector' },
                                            { type: 'tab', name: 'Assets', component: 'assets', id: 'assets' },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        type: 'tabset',
                        weight: 25,
                        children:[
                            { type: 'tab', name: 'Console', component: 'console', id: 'console' }
                        ],
                    }
                ],
            }
        ],
    },
};

export function createDefaultDockLayout() {
    return JSON.parse(JSON.stringify(DEFAULT_DOCK_LAYOUT));
}