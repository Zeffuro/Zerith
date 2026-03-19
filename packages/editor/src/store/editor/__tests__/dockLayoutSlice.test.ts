import { describe, expect, it, vi } from 'vitest';

const mockedDockDefaults = vi.hoisted(() => ({
    createDefaultDockLayout: vi.fn(() => ({
        global: { splitterSize: 4 },
        layout: { children: [], type: 'row' },
    })),
    DOCK_LAYOUT_VERSION: 4,
}));

vi.mock('../../../components/layout/dock/defaultDockLayout', () => ({
    createDefaultDockLayout: mockedDockDefaults.createDefaultDockLayout,
    DOCK_LAYOUT_VERSION: mockedDockDefaults.DOCK_LAYOUT_VERSION,
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
            layout: { children: [], type: 'row' },
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

    it('slice actions reset and set dock layout json through set()', () => {
        let state: Record<string, unknown> = {};
        const set = (
            partial: ((current: Record<string, unknown>) => Record<string, unknown>) | Record<string, unknown>,
        ) => {
            const patch = typeof partial === 'function' ? partial(state) : partial;
            state = { ...state, ...patch };
        };

        const slice = createDockLayoutSlice(set as never);
        slice.setDockLayoutJson({ global: { splitterSize: 1 }, layout: { children: [] } });
        expect(state.dockLayoutJson).toEqual({ global: { splitterSize: 1 }, layout: { children: [] } });

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
        slice.setDockLayoutJson({ global: { splitterSize: 1 }, layout: { children: [] } });

        slice.registerDockLayoutJsonSnapshotProvider(() => ({ global: { splitterSize: 9 }, layout: { children: ['a'] } }));
        expect(slice.captureDockLayoutJson()).toEqual({ global: { splitterSize: 9 }, layout: { children: ['a'] } });

        slice.registerDockLayoutJsonSnapshotProvider();
        expect(slice.captureDockLayoutJson()).toEqual({ global: { splitterSize: 1 }, layout: { children: [] } });
    });
});

