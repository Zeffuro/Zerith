import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    collect: vi.fn<() => Promise<void>>(),
    inventory: vi.fn<() => Promise<string[]>>(),
    project: { projectPath: '/A' },
    setSnapshot: vi.fn(),
}));
vi.mock('../../store/storeBootstrap', () => ({ useProjectStore: { getState: () => mocks.project } }));
vi.mock('../../store/useReferenceStore', () => ({ useReferenceStore: {
    getState: () => ({ setSnapshot: mocks.setSnapshot }),
} }));
vi.mock('../referenceScanner/assets', () => ({ collectDataAssetReferences: mocks.collect, listProjectAssetFiles: mocks.inventory }));
vi.mock('../referenceScanner/coordinator', () => ({ scanProjectScriptBranches: vi.fn() }));
vi.mock('../referenceScanner/treeScan', () => ({ scanReferenceTree: vi.fn() }));

import { refreshReferenceScannerState } from '../referenceScanner/refresh';

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>(yes => { resolve = yes; });
    return { promise, resolve };
}

describe('owned reference refresh publication', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.collect.mockImplementation(() => Promise.resolve());
        mocks.inventory.mockResolvedValue(['/assets/tone.wav']);
        mocks.project = { projectPath: '/A' };
    });

    it('publishes a current reference result and inventory', async () => {
        await refreshReferenceScannerState(() => true);
        expect(mocks.setSnapshot).toHaveBeenCalledOnce();
        expect(mocks.setSnapshot).toHaveBeenCalledWith(expect.objectContaining({ assetInventory: ['/assets/tone.wav'] }));
    });

    it('does not read or publish for a retired caller', async () => {
        await expect(refreshReferenceScannerState(() => false)).rejects.toThrow('cancelled');
        expect(mocks.collect).not.toHaveBeenCalled();
        expect(mocks.setSnapshot).not.toHaveBeenCalled();
    });

    it('drops a completion retired while scanning without overwriting the successor', async () => {
        let current = true;
        const pending = deferred();
        mocks.collect.mockReturnValueOnce(pending.promise);
        const run = refreshReferenceScannerState(() => current);
        current = false;
        mocks.project = { projectPath: '/B' };
        pending.resolve(); await run;
        expect(mocks.setSnapshot).not.toHaveBeenCalled();
    });

    it('publishes both fields before a subscriber retires the owner', async () => {
        let current = true;
        mocks.setSnapshot.mockImplementationOnce(() => { current = false; });
        await refreshReferenceScannerState(() => current);
        expect(mocks.setSnapshot).toHaveBeenCalledOnce();
        expect(mocks.setSnapshot).toHaveBeenCalledWith(expect.objectContaining({ assetInventory: ['/assets/tone.wav'] }));
    });
});
