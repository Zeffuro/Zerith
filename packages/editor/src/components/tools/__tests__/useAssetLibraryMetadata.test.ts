import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AssetLibraryMetadataSnapshot } from '../../../services/assetLibraryMetadata';
import type { ReferenceScannerStateSnapshot } from '../../../services/referenceScanner/refresh';

const mocks = vi.hoisted(() => {
    const project: { projectGeneration: number; projectPath: string | undefined } = { projectGeneration: 1, projectPath: '/A' };
    return {
    effects: [] as (() => void)[],
    index: 0,
    inventory: [] as string[],
    load: vi.fn<() => Promise<AssetLibraryMetadataSnapshot>>(),
    project,
    refresh: vi.fn<(isCurrent: () => boolean) => Promise<ReferenceScannerStateSnapshot>>(),
    report: vi.fn(),
    save: vi.fn<(path: string, metadata: unknown, snapshot: AssetLibraryMetadataSnapshot, dependencies: unknown, current: () => boolean) => Promise<void>>(),
    setters: vi.fn(),
    slots: [] as { cleanup?: () => void; deps?: unknown[]; value?: unknown }[],
    };
});

vi.mock('react', () => ({
    useEffect: (factory: () => (() => void) | void, deps: unknown[]) => {
        const index = mocks.index++;
        const previous = mocks.slots[index];
        if (!previous || deps.some((value, position) => value !== previous.deps?.[position])) {
            const slot = mocks.slots[index] = { deps } as typeof previous;
            mocks.effects.push(() => { previous?.cleanup?.(); slot.cleanup = factory() ?? undefined; });
        }
    },
    useMemo: (factory: () => unknown, deps: unknown[]) => {
        const index = mocks.index++;
        const previous = mocks.slots[index];
        if (!previous || deps.some((value, position) => value !== previous.deps?.[position])) mocks.slots[index] = { deps, value: factory() };
        return mocks.slots[index].value;
    },
    useState: (initial: unknown) => {
        const index = mocks.index++;
        mocks.slots[index] ??= { value: initial };
        return [mocks.slots[index].value, (value: unknown) => { mocks.setters(value); mocks.slots[index].value = value; }];
    },
}));
vi.mock('../../../services/assetLibraryMetadata', async importOriginal => ({
    ...await importOriginal<typeof import('../../../services/assetLibraryMetadata')>(),
    loadAssetLibraryMetadataSnapshot: mocks.load,
    saveAssetLibraryMetadata: mocks.save,
}));
vi.mock('../../../services/referenceScanner', () => ({ refreshReferenceScannerState: mocks.refresh }));
vi.mock('../../../store/actions/consoleMessageActions', () => ({ executeConsoleMessageAction: mocks.report }));
vi.mock('../../../store/storeBootstrap', () => ({ useProjectStore: { getState: () => mocks.project } }));

import { createEmptyAssetLibraryMetadata, setAssetLibraryAssetMetadata } from '../../../services/assetLibraryMetadata';
import { useAssetLibraryMetadata } from '../useAssetLibraryMetadata';

function AssetSubject() { return useAssetLibraryMetadata(mocks.project.projectPath, mocks.project.projectGeneration, mocks.inventory); }
function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, reject, resolve };
}
function render(flush = true) {
    mocks.index = 0;
    const result = AssetSubject();
    if (flush) for (const effect of mocks.effects.splice(0)) effect();
    return result;
}
async function settle() { for (let index = 0; index < 5; index++) await Promise.resolve(); }
const update = (metadata: ReturnType<typeof createEmptyAssetLibraryMetadata>) => setAssetLibraryAssetMetadata(metadata, '/assets/a', { tags: ['saved'] });

describe('asset library hook session ownership', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.slots.length = mocks.effects.length = 0;
        mocks.inventory = [];
        mocks.project = { projectGeneration: 1, projectPath: '/A' };
        mocks.load.mockResolvedValue({ metadata: createEmptyAssetLibraryMetadata(), text: '{"assets":{}}' });
        mocks.save.mockResolvedValue();
        mocks.refresh.mockResolvedValue({ assetInventory: ['/assets/a'], result: { assetFiles: {}, assets: {}, characters: {}, items: {}, variables: {} } });
    });

    it('loads and saves the current project and refreshes its references', async () => {
        render();
        await settle();
        expect(render().disabled).toBe(false);
        await expect(render().coordinator.mutate(update, 'saved')).resolves.toBe(true);
        expect(render().metadata.assets['/assets/a']?.tags).toEqual(['saved']);
        expect(mocks.save.mock.calls[0][2].text).toBe('{"assets":{}}');
        expect(mocks.refresh).toHaveBeenCalledOnce();
        expect(mocks.refresh.mock.calls[0][0]()).toBe(true);
        expect(mocks.report).toHaveBeenCalledWith('editor', 'info', 'saved', undefined);
    });

    it.each(['B', 'A', 'B-A', 'closed'] as const)('retires saves immediately on %s replacement before effect cleanup', async target => {
        render();
        await settle();
        const pending = deferred<void>();
        mocks.save.mockReturnValueOnce(pending.promise);
        const running = render().coordinator.mutate(update, 'old saved');
        mocks.project = { projectGeneration: target === 'B-A' ? 3 : 2, projectPath: target === 'closed' ? undefined : (target === 'B' ? '/B' : '/A') };
        expect(render(false)).toMatchObject({ ready: false, saving: false });
        expect(mocks.save.mock.calls[0][4]()).toBe(false);
        const count = mocks.setters.mock.calls.length;
        pending.resolve();
        await expect(running).resolves.toBe(false);
        expect(mocks.setters).toHaveBeenCalledTimes(count);
        expect(mocks.refresh).not.toHaveBeenCalled();
        expect(mocks.report).not.toHaveBeenCalled();
    });

    it.each(['success', 'failure'] as const)('retires a pending load %s on same-path generation replacement', async outcome => {
        const pending = deferred<AssetLibraryMetadataSnapshot>();
        mocks.load.mockReturnValueOnce(pending.promise);
        render();
        mocks.project.projectGeneration++;
        render();
        await settle();
        const count = mocks.setters.mock.calls.length;
        if (outcome === 'success') pending.resolve({ metadata: update(createEmptyAssetLibraryMetadata()), text: 'old' });
        else pending.reject(new Error('old denied'));
        await settle();
        expect(render().metadata.assets).toEqual({});
        expect(mocks.setters).toHaveBeenCalledTimes(count);
        expect(mocks.report).not.toHaveBeenCalled();
    });

    it('suppresses pending reference publication when the project changes', async () => {
        render();
        await settle();
        const pending = deferred<ReferenceScannerStateSnapshot>();
        mocks.refresh.mockReturnValueOnce(pending.promise);
        const running = render().coordinator.mutate(update, 'saved');
        await settle();
        mocks.project.projectGeneration++;
        pending.resolve({ assetInventory: ['/old'], result: { assetFiles: {}, assets: {}, characters: {}, items: {}, variables: {} } });
        await expect(running).resolves.toBe(false);
        expect(mocks.refresh).toHaveBeenCalledOnce();
        expect(mocks.refresh.mock.calls[0][0]()).toBe(false);
        expect(mocks.report).not.toHaveBeenCalled();
    });

    it.each(['success', 'failure'] as const)('drops pending save %s after unmount', async outcome => {
        render();
        await settle();
        const pending = deferred<void>();
        mocks.save.mockReturnValueOnce(pending.promise);
        const running = render().coordinator.mutate(update, 'saved');
        for (const slot of mocks.slots) slot.cleanup?.();
        const count = mocks.setters.mock.calls.length;
        if (outcome === 'success') pending.resolve();
        else pending.reject(new Error('old failure'));
        await running;
        expect(mocks.setters).toHaveBeenCalledTimes(count);
        expect(mocks.report).not.toHaveBeenCalled();
    });

    it('retains known metadata after failed inventory reload and clears failure after retry', async () => {
        mocks.load.mockResolvedValueOnce({ metadata: update(createEmptyAssetLibraryMetadata()), text: 'known' });
        render();
        await settle();
        mocks.load.mockRejectedValueOnce(new Error('denied'));
        mocks.inventory = ['/new'];
        render();
        await settle();
        expect(render()).toMatchObject({ disabled: true, error: 'Error: denied', metadata: { assets: { '/assets/a': { tags: ['saved'] } } } });
        await render().coordinator.load();
        expect(render()).toMatchObject({ disabled: false, error: undefined });
    });
});
