import type { Command } from '@zeffuro/zerith-core';

import { describe, expect, it, vi } from 'vitest';

import type { ScriptPath } from '../../../utils/scriptPathUtilities';
import type { GetPathOpsProjectBridge, PathOpsProjectBridge } from '../bridges/pathOpsProjectBridge';
import type { ScriptState } from '../types';

import { createSliceHarness } from '../../../test-utils/createSliceHarness';
import { createPathOpsSlice } from '../slices/pathOpsSlice';

vi.mock('@zeffuro/zerith-core', () => ({
    deepClone: <Value>(value: Value): Value => structuredClone(value),
}));

type PathOpsHarnessState = Pick<
    ScriptState,
    | 'future'
    | 'moveNodeByPath'
    | 'moveNodesByPathsToArray'
    | 'moveTimelineNode'
    | 'moveTimelineNodesToArray'
    | 'past'
    | 'rootScript'
    | 'scopePath'
    | 'selectedNodeIndex'
    | 'selectedNodePath'
>;

function createPathOpsHarness(getProjectBridge: GetPathOpsProjectBridge) {
    const harness = createSliceHarness<PathOpsHarnessState>({
        future: [],
        moveNodeByPath: () => {},
        moveNodesByPathsToArray: () => {},
        moveTimelineNode: () => {},
        moveTimelineNodesToArray: () => {},
        past: [],
        rootScript: [],
        scopePath: [],
        selectedNodeIndex: undefined,
        selectedNodePath: undefined,
    });

    const set = harness.set as never;
    const get = harness.get as never;

    harness.setState({
        ...createPathOpsSlice(set, get, getProjectBridge),
    });

    return harness;
}

function createProjectBridge(overrides?: Partial<PathOpsProjectBridge>): PathOpsProjectBridge {
    return {
        editingAllMacrosFile: true,
        macroEntries: [],
        moveMacroEntries: vi.fn(),
        updateMacroCommands: vi.fn(),
        ...overrides,
    };
}

function createWait(duration: number): Command {
    return { duration, type: 'wait' };
}

function readWaitDurations(commands: Command[]): number[] {
    return commands.map((command) => (command as unknown as { duration: number; }).duration);
}

describe('pathOps timeline actions', () => {
    it('falls back to script moveNodeByPath when all-macros mode is disabled', () => {
        const bridge = createProjectBridge({ editingAllMacrosFile: false });
        const harness = createPathOpsHarness(() => bridge);

        harness.setState({
            rootScript: [createWait(1), createWait(2)],
        });

        harness.get().moveTimelineNode([0], [] as ScriptPath, 2);

        expect(readWaitDurations(harness.get().rootScript as Command[])).toEqual([2, 1]);
        expect(bridge.moveMacroEntries).not.toHaveBeenCalled();
    });

    it('delegates root timeline drag to moveMacroEntries in all-macros mode', () => {
        const bridge = createProjectBridge();
        const harness = createPathOpsHarness(() => bridge);

        harness.get().moveTimelineNode([1], [] as ScriptPath, 0);

        expect(bridge.moveMacroEntries).toHaveBeenCalledWith([1], 0);
        expect(bridge.updateMacroCommands).not.toHaveBeenCalled();
    });

    it('delegates intra-macro command drag to updateMacroCommands', () => {
        const bridge = createProjectBridge({
            macroEntries: [
                {
                    commands: [createWait(1), createWait(2), createWait(3)],
                    name: 'macro_one',
                },
            ],
        });
        const harness = createPathOpsHarness(() => bridge);

        harness.get().moveTimelineNode([0, 'body', 2], [0, 'body'], 0);

        expect(bridge.updateMacroCommands).toHaveBeenCalledTimes(1);
        const [macroIndex, updatedCommands] = (bridge.updateMacroCommands as ReturnType<typeof vi.fn>).mock.calls[0] as [
            number,
            Command[],
        ];
        expect(macroIndex).toBe(0);
        expect(readWaitDurations(updatedCommands)).toEqual([3, 1, 2]);
    });

    it('falls back to script multi-move when project bridge is unavailable', () => {
        const unavailableBridge: PathOpsProjectBridge | undefined = undefined;
        const harness = createPathOpsHarness(() => unavailableBridge);

        harness.setState({
            rootScript: [createWait(1), createWait(2), createWait(3)],
        });

        harness.get().moveTimelineNodesToArray([[0], [1]], [] as ScriptPath, 3);

        expect(readWaitDurations(harness.get().rootScript as Command[])).toEqual([3, 1, 2]);
    });

    it('delegates root multi-select drag to moveMacroEntries in all-macros mode', () => {
        const bridge = createProjectBridge();
        const harness = createPathOpsHarness(() => bridge);

        harness.get().moveTimelineNodesToArray([[2], [0]], [] as ScriptPath, 1);

        expect(bridge.moveMacroEntries).toHaveBeenCalledWith([2, 0], 1);
    });
});


