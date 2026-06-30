import { describe, expect, it, vi } from 'vitest';

import type { OperationStatusSlice } from '../types';

import { createSliceHarness } from '../../../test-utils/createSliceHarness';
import { createOperationStatusSlice } from '../slices/operationStatusSlice';

describe('createOperationStatusSlice', () => {
    it('announces and clears transient operation status', () => {
        vi.spyOn(Date, 'now').mockReturnValue(1234);
        const harness = createSliceHarness<OperationStatusSlice>({
            announceOperationStatus: () => {},
            clearOperationStatus: () => {},
            lastOperationStatus: undefined,
        });
        const slice = createOperationStatusSlice(harness.set as never);

        slice.announceOperationStatus('Content migration started.');
        expect(harness.get().lastOperationStatus).toEqual({
            id: 1234,
            message: 'Content migration started.',
            tone: 'info',
        });

        slice.clearOperationStatus();
        expect(harness.get().lastOperationStatus).toBeUndefined();

        vi.restoreAllMocks();
    });

    it('preserves explicit status tone', () => {
        vi.spyOn(Date, 'now').mockReturnValue(4321);
        const harness = createSliceHarness<OperationStatusSlice>({
            announceOperationStatus: () => {},
            clearOperationStatus: () => {},
            lastOperationStatus: undefined,
        });
        const slice = createOperationStatusSlice(harness.set as never);

        slice.announceOperationStatus('Content migration wrote conflicts.', 'warning');
        expect(harness.get().lastOperationStatus).toEqual({
            id: 4321,
            message: 'Content migration wrote conflicts.',
            tone: 'warning',
        });

        vi.restoreAllMocks();
    });
});
