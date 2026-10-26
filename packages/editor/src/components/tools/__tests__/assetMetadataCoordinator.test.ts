import { describe, expect, it, vi } from 'vitest';

import {
    addAssetLibraryCollectionToAssets,
    createEmptyAssetLibraryMetadata,
    setAssetLibraryAssetMetadata,
} from '../../../services/assetLibraryMetadata';
import { createAssetMetadataCoordinator } from '../assetMetadataCoordinator';

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, reject, resolve };
}

function setup() {
    let current = true;
    const metadata = createEmptyAssetLibraryMetadata();
    const dependencies = {
        load: vi.fn<Parameters<typeof createAssetMetadataCoordinator>[0]['load']>().mockResolvedValue({ metadata, text: '{"assets":{}}' }),
        ownsSession: () => current,
        publish: vi.fn(),
        refresh: vi.fn<Parameters<typeof createAssetMetadataCoordinator>[0]['refresh']>().mockResolvedValue(),
        report: vi.fn(),
        save: vi.fn<Parameters<typeof createAssetMetadataCoordinator>[0]['save']>().mockResolvedValue(),
    };
    const coordinator = createAssetMetadataCoordinator(dependencies);
    coordinator.activate();
    return { coordinator, dependencies, retire: () => { current = false; } };
}

const single = (metadata: ReturnType<typeof createEmptyAssetLibraryMetadata>) => setAssetLibraryAssetMetadata(metadata, '/assets/a', { tags: ['single'] });
const bulk = (metadata: ReturnType<typeof createEmptyAssetLibraryMetadata>) => addAssetLibraryCollectionToAssets(metadata, ['/assets/a', '/assets/b'], 'bulk');

describe('asset metadata coordinator', () => {
    it.each([true, false])('rejects overlap safely with single first=%s and permits retry against current metadata', async singleFirst => {
        const { coordinator, dependencies } = setup();
        await coordinator.load();
        const pending = deferred<void>();
        dependencies.save.mockReturnValueOnce(pending.promise);
        const first = singleFirst ? single : bulk;
        const second = singleFirst ? bulk : single;
        const running = coordinator.mutate(first, 'first');
        expect(coordinator.getState().saving).toBe(true);
        await expect(coordinator.mutate(second, 'second')).resolves.toBe(false);
        expect(dependencies.save).toHaveBeenCalledTimes(1);
        pending.resolve();
        await expect(running).resolves.toBe(true);
        await expect(coordinator.mutate(second, 'retry')).resolves.toBe(true);
        expect(dependencies.save.mock.calls[1][1].text).toContain(singleFirst ? 'single' : 'bulk');
        // Single-asset replacement intentionally controls that asset's collection list.
        expect(coordinator.getState().metadata.assets['/assets/a']?.tags).toEqual(['single']);
        if (singleFirst) expect(coordinator.getState().metadata.assets['/assets/a']?.collections).toEqual(['bulk']);
        else expect(coordinator.getState().metadata.assets['/assets/b']?.collections).toEqual(['bulk']);
    });

    it.each(['session', 'unmount'])('retires save success, refresh, status and busy publications on %s', async target => {
        const { coordinator, dependencies, retire } = setup();
        await coordinator.load();
        const pending = deferred<void>();
        dependencies.save.mockReturnValueOnce(pending.promise);
        const running = coordinator.mutate(single, 'saved');
        const count = dependencies.publish.mock.calls.length;
        if (target === 'session') retire();
        else coordinator.deactivate();
        expect(dependencies.save.mock.calls[0][2]()).toBe(false);
        pending.resolve();
        await expect(running).resolves.toBe(false);
        expect(dependencies.publish).toHaveBeenCalledTimes(count);
        expect(dependencies.refresh).not.toHaveBeenCalled();
        expect(dependencies.report).not.toHaveBeenCalled();
    });

    it('retires late save errors', async () => {
        const { coordinator, dependencies, retire } = setup();
        await coordinator.load();
        const pending = deferred<void>();
        dependencies.save.mockReturnValueOnce(pending.promise);
        const running = coordinator.mutate(single, 'saved');
        retire();
        const count = dependencies.publish.mock.calls.length;
        pending.reject(new Error('old failure'));
        await running;
        expect(dependencies.publish).toHaveBeenCalledTimes(count);
        expect(dependencies.report).not.toHaveBeenCalled();
    });

    it('keeps known labels and blocks all mutations after failed reload until a successful retry', async () => {
        const { coordinator, dependencies } = setup();
        await coordinator.load();
        await coordinator.mutate(single, 'saved');
        dependencies.load.mockRejectedValueOnce(new Error('permission denied'));
        await coordinator.load();
        expect(coordinator.getState()).toMatchObject({ metadata: { assets: { '/assets/a': { tags: ['single'] } } }, ready: false });
        await expect(coordinator.mutate(bulk, 'blocked')).resolves.toBe(false);
        expect(dependencies.save).toHaveBeenCalledTimes(1);
        dependencies.load.mockResolvedValueOnce({ metadata: coordinator.getState().metadata, text: 'new bytes' });
        await coordinator.load();
        await expect(coordinator.mutate(bulk, 'saved')).resolves.toBe(true);
        expect(dependencies.save.mock.calls[1][1].text).toBe('new bytes');
        expect(coordinator.getState()).toMatchObject({ error: undefined, ready: true, saving: false });
    });

    it('keeps the old snapshot after a failed save and permits a current retry', async () => {
        const { coordinator, dependencies } = setup();
        await coordinator.load();
        dependencies.save.mockRejectedValueOnce(new Error('failed'));
        await expect(coordinator.mutate(single, 'saved')).resolves.toBe(false);
        expect(coordinator.getState()).toMatchObject({ metadata: { assets: {} }, saving: false });
        await expect(coordinator.mutate(single, 'saved')).resolves.toBe(true);
        expect(dependencies.save.mock.calls[1][1].text).toBe('{"assets":{}}');
    });

    it('holds inventory refresh until the mutation finishes', async () => {
        const { coordinator, dependencies } = setup();
        await coordinator.load();
        const pending = deferred<void>();
        dependencies.save.mockReturnValueOnce(pending.promise);
        const running = coordinator.mutate(single, 'saved');
        await coordinator.load();
        expect(dependencies.load).toHaveBeenCalledTimes(1);
        dependencies.load.mockResolvedValueOnce({ metadata: single(createEmptyAssetLibraryMetadata()), text: 'written' });
        pending.resolve();
        await running;
        await Promise.resolve();
        expect(dependencies.load).toHaveBeenCalledTimes(2);
        expect(coordinator.getState().metadata.assets['/assets/a']?.tags).toEqual(['single']);
    });

    it('rejects mutation during initial loading and ignores an earlier overlapping load', async () => {
        const { coordinator, dependencies } = setup();
        const old = deferred<{ metadata: ReturnType<typeof createEmptyAssetLibraryMetadata> }>();
        dependencies.load.mockReturnValueOnce(old.promise);
        const first = coordinator.load();
        await expect(coordinator.mutate(single, 'blocked')).resolves.toBe(false);
        dependencies.load.mockResolvedValueOnce({ metadata: single(createEmptyAssetLibraryMetadata()), text: 'current' });
        await coordinator.load();
        old.resolve({ metadata: createEmptyAssetLibraryMetadata() });
        await first;
        expect(coordinator.getState().metadata.assets['/assets/a']?.tags).toEqual(['single']);
    });

    it('passes ownership through a pending reference refresh and drops late warnings', async () => {
        const { coordinator, dependencies, retire } = setup();
        await coordinator.load();
        const pending = deferred<void>();
        dependencies.refresh.mockReturnValueOnce(pending.promise);
        const running = coordinator.mutate(single, 'saved');
        await Promise.resolve();
        expect(dependencies.refresh).toHaveBeenCalledTimes(1);
        retire();
        expect(dependencies.refresh.mock.calls[0][0]()).toBe(false);
        pending.reject(new Error('old refresh'));
        await expect(running).resolves.toBe(false);
        expect(dependencies.report).not.toHaveBeenCalled();
    });
});
