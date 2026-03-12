import { describe, expect, it } from 'vitest';

import type { EditorNode } from '../../../types/EditorNode';

import { createSliceHarness } from '../../../test-utils/createSliceHarness';
import { createHistorySlice } from '../slices/historySlice';
import { createRootScriptSlice } from '../slices/rootScriptSlice';
import { createSelectionSlice } from '../slices/selectionSlice';

type CoreSliceState = {
    canRedo: () => boolean;
    canUndo: () => boolean;
    future: EditorNode[][];
    past: EditorNode[][];
    popScope: () => void;
    pushScope: (index: number, branch: string) => void;
    redo: () => void;
    resetScope: () => void;
    rootScript: EditorNode[];
    scopePath: Array<number | string>;
    selectedNodeIndex: number | undefined;
    selectedNodePath: Array<number | string> | undefined;
    setScript: (script: EditorNode[]) => void;
    setSelectedNode: (index: number | undefined) => void;
    setSelectedNodePath: (path: Array<number | string> | undefined) => void;
    undo: () => void;
};

const waitNode = (duration: number): EditorNode => ({ duration, type: 'wait' } as EditorNode);

const createLegacyIfNode = (): EditorNode =>
    JSON.parse('{"type":"if","then":[]}') as EditorNode;

function createCoreSliceState(): ReturnType<typeof createSliceHarness<CoreSliceState>> {
    const harness = createSliceHarness<CoreSliceState>({
        canRedo: () => false,
        canUndo: () => false,
        future: [],
        past: [],
        popScope: () => {},
        pushScope: () => {},
        redo: () => {},
        resetScope: () => {},
        rootScript: [],
        scopePath: [],
        selectedNodeIndex: undefined,
        selectedNodePath: undefined,
        setScript: () => {},
        setSelectedNode: () => {},
        setSelectedNodePath: () => {},
        undo: () => {},
    });

    const set = harness.set as never;
    const get = harness.get as never;
    harness.setState({
        ...createRootScriptSlice(set, get),
        ...createSelectionSlice(set, get),
        ...createHistorySlice(set, get),
    });

    return harness;
}

function readWaitDuration(node: EditorNode): number {
    return (node as unknown as { duration: number; }).duration;
}

describe('script core slices', () => {
    it('setScript resets history/scope and normalizes incoming nodes', () => {
        const harness = createCoreSliceState();
        harness.setState({
            future: [[waitNode(3)]],
            past: [[waitNode(1)]],
            scopePath: [0, 'body'],
            selectedNodeIndex: 0,
            selectedNodePath: [0, 'body', 0],
        });

        harness.get().setScript([createLegacyIfNode()]);

        const next = harness.get();
        expect(next.past).toEqual([]);
        expect(next.future).toEqual([]);
        expect(next.scopePath).toEqual([]);
        expect(next.selectedNodeIndex).toBeUndefined();
        expect(next.selectedNodePath).toBeUndefined();
        expect((next.rootScript[0] as Record<string, unknown>).onTrue).toEqual([]);
        expect((next.rootScript[0] as Record<string, unknown>).onFalse).toEqual([]);
    });

    it('selection slice updates scope and selected path coherently', () => {
        const harness = createCoreSliceState();
        const state = harness.get();

        state.pushScope(2, 'onTrue');
        expect(harness.get().scopePath).toEqual([2, 'onTrue']);

        state.setSelectedNode(1);
        expect(harness.get().selectedNodeIndex).toBe(1);
        expect(harness.get().selectedNodePath).toEqual([2, 'onTrue', 1]);

        state.setSelectedNodePath([2, 'onTrue', 3]);
        expect(harness.get().selectedNodeIndex).toBe(3);

        state.setSelectedNodePath([99]);
        expect(harness.get().selectedNodeIndex).toBeUndefined();
        expect(harness.get().selectedNodePath).toEqual([99]);

        state.popScope();
        expect(harness.get().scopePath).toEqual([]);
        expect(harness.get().selectedNodePath).toBeUndefined();
    });

    it('history slice undo/redo traverses snapshots and resets selection context', () => {
        const harness = createCoreSliceState();
        harness.setState({
            future: [[waitNode(3)]],
            past: [[waitNode(1)]],
            rootScript: [waitNode(2)],
            scopePath: [0, 'body'],
            selectedNodeIndex: 0,
            selectedNodePath: [0, 'body', 0],
        });

        expect(harness.get().canUndo()).toBe(true);
        harness.get().undo();

        expect(readWaitDuration(harness.get().rootScript[0])).toBe(1);
        expect(readWaitDuration(harness.get().future[0][0])).toBe(2);
        expect(harness.get().scopePath).toEqual([]);
        expect(harness.get().selectedNodeIndex).toBeUndefined();

        expect(harness.get().canRedo()).toBe(true);
        harness.get().redo();

        expect(readWaitDuration(harness.get().rootScript[0])).toBe(2);
        expect(readWaitDuration(harness.get().past[0][0])).toBe(1);
        expect(harness.get().scopePath).toEqual([]);
        expect(harness.get().selectedNodePath).toBeUndefined();
    });
});

