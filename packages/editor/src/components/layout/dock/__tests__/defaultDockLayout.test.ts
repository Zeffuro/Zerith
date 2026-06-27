import { describe, expect, it, vi } from 'vitest';

vi.mock('core', () => ({
    deepClone: <T>(value: T): T => structuredClone(value),
}));

import { createDefaultDockLayout, isUsableDockLayoutJson, normalizeDockLayoutJsonForFlexLayout } from '../defaultDockLayout';

describe('defaultDockLayout', () => {
    it('creates a usable default layout', () => {
        const layout = createDefaultDockLayout();

        expect(isUsableDockLayoutJson(layout)).toBe(true);
        expect(JSON.stringify(layout)).not.toContain('"type":"column"');
        expect(JSON.stringify(layout)).not.toContain('"component":"localization"');
    });

    it('rejects layouts that only have the outer JSON shape', () => {
        expect(isUsableDockLayoutJson({ global: {}, layout: { children: [], type: 'row' } })).toBe(false);
    });

    it('rejects layouts without the editor dock panel', () => {
        expect(isUsableDockLayoutJson({
            global: {},
            layout: {
                children: [
                    {
                        children: [{ component: 'explorer', id: 'explorer', name: 'Explorer', type: 'tab' }],
                        type: 'tabset',
                    },
                ],
                type: 'row',
            },
        })).toBe(false);
    });

    it('normalizes legacy column nodes to row nodes before FlexLayout parsing', () => {
        const normalized = normalizeDockLayoutJsonForFlexLayout({
            global: {},
            layout: {
                children: [
                    {
                        children: [{ component: 'explorer', id: 'explorer', name: 'Explorer', type: 'tab' }],
                        type: 'tabset',
                    },
                    {
                        children: [{ component: 'editor', id: 'editor', name: 'Editor', type: 'tab' }],
                        type: 'column',
                    },
                ],
                type: 'row',
            },
        });

        expect(normalized).toBeDefined();
        expect(JSON.stringify(normalized)).not.toContain('"type":"column"');
        expect(JSON.stringify(normalized)).toContain('"type":"row"');
    });
});
