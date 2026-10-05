import { describe, expect, it, vi } from 'vitest';

import type { FlowManagerDeps } from '../FlowManager';

import { createLoggerMock } from '../../test-utils/audioHarness';
import { deferred, pluginHandler } from '../../test-utils/runtimePluginHarness';
import { FlowManager } from '../FlowManager';

function fixture() {
    const handlers: FlowManagerDeps['handlers'] = new Map();
    const logger = createLoggerMock();
    const flow = new FlowManager({ events: {}, handlers, logger, scenes: {} } as FlowManagerDeps);
    return { flow, handlers, logger };
}

describe('FlowManager handler teardown', () => {
    it('removes the handler before a reentrant or throwing destroy', () => {
        const { flow } = fixture();
        const handler = pluginHandler();
        handler.destroy.mockImplementation(() => {
            expect(flow.getHandler('marker')).toBeUndefined();
            void flow.unregisterHandler('marker');
            throw new Error('destroy failed');
        });
        flow.registerHandler(handler);
        expect(() => flow.unregisterHandler('marker')).toThrow('destroy failed');
        expect(flow.getHandler('marker')).toBeUndefined();
        expect(handler.destroy).toHaveBeenCalledOnce();
    });

    it('returns asynchronous disposal to its owner', async () => {
        const { flow } = fixture();
        const handler = pluginHandler();
        const gate = deferred();
        handler.destroy.mockReturnValue(gate.promise);
        flow.registerHandler(handler);
        const disposal = flow.unregisterHandler('marker');
        expect(flow.getHandler('marker')).toBeUndefined();
        expect(disposal).toBe(gate.promise);
        gate.reject(new Error('async destroy failed'));
        await expect(disposal).rejects.toThrow('async destroy failed');
    });

    it('can detach a slot while the handler lifetime remains owned elsewhere', () => {
        const { flow } = fixture();
        const handler = pluginHandler();
        flow.registerHandler(handler);
        void flow.unregisterHandler('marker', { destroy: false });
        expect(flow.getHandler('marker')).toBeUndefined();
        expect(handler.destroy).not.toHaveBeenCalled();
    });

    it('clears all ownership and completes teardown despite sync and async failures', async () => {
        const { flow, logger } = fixture();
        const first = pluginHandler('first');
        const second = pluginHandler('second');
        const third = pluginHandler('third');
        const error = vi.spyOn(logger, 'error');
        first.destroy.mockImplementation(() => { throw new Error('sync destroy'); });
        second.destroy.mockRejectedValue(new Error('async destroy'));
        flow.registerHandlers([first, second, third]);
        flow.destroyHandlers();
        flow.destroyHandlers();
        for (const handler of [first, second, third]) {
            expect(flow.getHandler(handler.type)).toBeUndefined();
            expect(handler.destroy).toHaveBeenCalledOnce();
        }
        await vi.waitFor(() => expect(error).toHaveBeenCalledTimes(2));
    });

    it('destroys a handler registered under multiple keys only once', () => {
        const { flow, handlers } = fixture();
        const handler = pluginHandler();
        handlers.set('first', handler);
        handlers.set('second', handler);
        flow.destroyHandlers();
        expect(handlers.size).toBe(0);
        expect(handler.destroy).toHaveBeenCalledOnce();
    });
});
