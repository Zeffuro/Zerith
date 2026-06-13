import { describe, expect, it, vi } from 'vitest';

function hasRequiredDockPanels(value: unknown): boolean {
    const serialized = JSON.stringify(value) ?? '';
    return serialized.includes('"component":"explorer"') && serialized.includes('"component":"editor"');
}

const mockedDockDefaults = vi.hoisted(() => {
    const normalizeLegacyTypes = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map((child) => normalizeLegacyTypes(child));
        if (!value || typeof value !== 'object') return value;
        return Object.fromEntries(Object.entries(value).map(([key, child]) => [
            key,
            key === 'type' && child === 'column' ? 'row' : normalizeLegacyTypes(child),
        ]));
    };
    return {
        createDefaultDockLayout: vi.fn(() => ({
            global: { splitterSize: 4 },
            layout: {
                children: [
                    { children: [{ component: 'explorer', id: 'explorer', name: 'Explorer', type: 'tab' }], type: 'tabset' },
                    { children: [{ component: 'editor', id: 'editor', name: 'Editor', type: 'tab' }], type: 'tabset' },
                ],
                type: 'row',
            },
        })),
        DOCK_LAYOUT_VERSION: 4,
        normalizeDockLayoutJsonForFlexLayout: vi.fn((value: unknown) => {
            const normalized = normalizeLegacyTypes(value);
            return hasRequiredDockPanels(normalized) ? normalized : undefined;
        }),
    };
});

vi.mock('../../../components/layout/dock/defaultDockLayout', () => ({
    createDefaultDockLayout: mockedDockDefaults.createDefaultDockLayout,
    DOCK_LAYOUT_VERSION: mockedDockDefaults.DOCK_LAYOUT_VERSION,
    normalizeDockLayoutJsonForFlexLayout: mockedDockDefaults.normalizeDockLayoutJsonForFlexLayout,
}));

import { createDefaultDockLayout, DOCK_LAYOUT_VERSION } from '../../../components/layout/dock/defaultDockLayout';
import { createDockLayoutSlice, normalizeDockLayoutState } from '../slices/dockLayoutSlice';

describe('dockLayoutSlice', () => {
    it('normalizeDockLayoutState falls back to defaults for invalid payloads', () => {
        const next = normalizeDockLayoutState({ dockLayoutJson: { layout: {} }, dockLayoutVersion: 99 });

        expect(next.dockLayoutVersion).toBe(DOCK_LAYOUT_VERSION);
        expect(next.dockLayoutJson).toEqual(createDefaultDockLayout());
    });

    it('normalizeDockLayoutState keeps persisted layout when version and shape are valid', () => {
        const persistedLayout = {
            global: { splitterSize: 8 },
            layout: {
                children: [
                    { children: [{ component: 'explorer', id: 'explorer', name: 'Explorer', type: 'tab' }], type: 'tabset' },
                    { children: [{ component: 'editor', id: 'editor', name: 'Editor', type: 'tab' }], type: 'tabset' },
                ],
                type: 'row',
            },
        };

        const next = normalizeDockLayoutState({
            dockLayoutJson: persistedLayout,
            dockLayoutVersion: DOCK_LAYOUT_VERSION,
        });

        expect(next).toEqual({
            dockLayoutJson: persistedLayout,
            dockLayoutVersion: DOCK_LAYOUT_VERSION,
        });
    });

    it('normalizeDockLayoutState migrates legacy column groups to FlexLayout row groups', () => {
        const next = normalizeDockLayoutState({
            dockLayoutJson: {
                global: { splitterSize: 8 },
                layout: {
                    children: [
                        { children: [{ component: 'explorer', id: 'explorer', name: 'Explorer', type: 'tab' }], type: 'tabset' },
                        { children: [{ component: 'editor', id: 'editor', name: 'Editor', type: 'tab' }], type: 'column' },
                    ],
                    type: 'row',
                },
            },
            dockLayoutVersion: DOCK_LAYOUT_VERSION,
        });

        expect(JSON.stringify(next.dockLayoutJson)).not.toContain('"type":"column"');
        expect(next.dockLayoutVersion).toBe(DOCK_LAYOUT_VERSION);
    });

    it('slice actions reset and set dock layout json through set()', () => {
        let state: Record<string, unknown> = {};
        const set = (
            partial: ((current: Record<string, unknown>) => Record<string, unknown>) | Record<string, unknown>,
        ) => {
            const patch = typeof partial === 'function' ? partial(state) : partial;
            state = { ...state, ...patch };
        };

        const slice = createDockLayoutSlice(set as never);
        const validLayout = {
            global: { splitterSize: 1 },
            layout: {
                children: [
                    { children: [{ component: 'explorer', id: 'explorer', name: 'Explorer', type: 'tab' }], type: 'tabset' },
                    { children: [{ component: 'editor', id: 'editor', name: 'Editor', type: 'tab' }], type: 'tabset' },
                ],
                type: 'row',
            },
        };
        slice.setDockLayoutJson(validLayout);
        expect(state.dockLayoutJson).toEqual(validLayout);
        expect(state.dockLayoutVersion).toBe(DOCK_LAYOUT_VERSION);

        slice.setDockLayoutJson({
            global: { tabEnableClose: false },
            layout: {
                children: [
                    { children: [{ component: 'explorer', id: 'explorer', name: 'Explorer', type: 'tab' }], type: 'tabset' },
                ],
                type: 'row',
            },
        });
        expect(state.dockLayoutJson).toEqual(createDefaultDockLayout());

        slice.resetDockLayout();
        expect(state.dockLayoutVersion).toBe(DOCK_LAYOUT_VERSION);
        expect(state.dockLayoutJson).toEqual(createDefaultDockLayout());
    });

    it('captures a live dock layout snapshot when a provider is registered', () => {
        let state: Record<string, unknown> = {};
        const set = (
            partial: ((current: Record<string, unknown>) => Record<string, unknown>) | Record<string, unknown>,
        ) => {
            const patch = typeof partial === 'function' ? partial(state) : partial;
            state = { ...state, ...patch };
        };

        const slice = createDockLayoutSlice(set as never);
        const validLayout = {
            global: { splitterSize: 1 },
            layout: {
                children: [
                    { children: [{ component: 'explorer', id: 'explorer', name: 'Explorer', type: 'tab' }], type: 'tabset' },
                    { children: [{ component: 'editor', id: 'editor', name: 'Editor', type: 'tab' }], type: 'tabset' },
                ],
                type: 'row',
            },
        };
        slice.setDockLayoutJson(validLayout);

        slice.registerDockLayoutJsonSnapshotProvider(() => ({
            global: { splitterSize: 9 },
            layout: {
                children: [
                    { children: [{ component: 'explorer', id: 'explorer', name: 'Explorer', type: 'tab' }], type: 'tabset' },
                    { children: [{ component: 'editor', id: 'editor', name: 'Editor', type: 'tab' }], type: 'tabset' },
                ],
                type: 'row',
            },
        }));
        expect(slice.captureDockLayoutJson()).toEqual({
            global: { splitterSize: 9 },
            layout: {
                children: [
                    { children: [{ component: 'explorer', id: 'explorer', name: 'Explorer', type: 'tab' }], type: 'tabset' },
                    { children: [{ component: 'editor', id: 'editor', name: 'Editor', type: 'tab' }], type: 'tabset' },
                ],
                type: 'row',
            },
        });

        slice.registerDockLayoutJsonSnapshotProvider(() => ({
            global: { tabEnableClose: false },
            layout: {
                children: [
                    { children: [{ component: 'explorer', id: 'explorer', name: 'Explorer', type: 'tab' }], type: 'tabset' },
                ],
                type: 'row',
            },
        }));
        expect(slice.captureDockLayoutJson()).toEqual(createDefaultDockLayout());

        slice.registerDockLayoutJsonSnapshotProvider();
        expect(slice.captureDockLayoutJson()).toEqual(validLayout);
    });
});

