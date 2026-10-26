import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DisplayManager } from '../DisplayManager';

const application = vi.hoisted(() => ({
    destroy: vi.fn(), init: vi.fn(), render: vi.fn(), stage: { addChild: vi.fn(), children: [] }, start: vi.fn(), stop: vi.fn(),
}));

vi.mock('../display/OwnedApplication', () => ({
    OwnedApplication: class { constructor() { return application; } },
}));

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>(complete => { resolve = complete; });
    return { promise, resolve };
}

const create = () => new DisplayManager({ scaleMode: 'fixed' });
const canvas = () => ({ height: 720, width: 1280 } as HTMLCanvasElement);

describe('DisplayManager render ownership', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        application.init.mockImplementation(() => Promise.resolve());
        vi.stubGlobal('window', { devicePixelRatio: 1, removeEventListener: vi.fn() });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('starts only after initialization and resumes after the last distinct lease', async () => {
        const display = create();
        await display.init(canvas());
        expect(application.init).toHaveBeenCalledWith(expect.objectContaining({ autoStart: false }));
        expect(application.start).toHaveBeenCalledTimes(1);
        const first = display.acquireRenderSuspension();
        const second = display.acquireRenderSuspension();
        expect(application.stop).toHaveBeenCalledTimes(1);
        second(); second();
        expect(application.start).toHaveBeenCalledTimes(1);
        first(); first();
        expect(application.start).toHaveBeenCalledTimes(2);
    });

    it('honors a lease acquired before asynchronous initialization finishes', async () => {
        const display = create();
        const pending = deferred();
        application.init.mockReturnValueOnce(pending.promise);
        const initialized = display.init(canvas());
        const release = display.acquireRenderSuspension();
        pending.resolve();
        await initialized;
        expect(application.start).not.toHaveBeenCalled();
        display.render();
        expect(application.render).toHaveBeenCalledTimes(1);
        release();
        expect(application.start).toHaveBeenCalledTimes(1);
    });

    it('starts after an initialization-time lease is released early', async () => {
        const display = create();
        const pending = deferred();
        application.init.mockReturnValueOnce(pending.promise);
        const initialized = display.init(canvas());
        const release = display.acquireRenderSuspension();
        release();
        expect(application.start).not.toHaveBeenCalled();
        pending.resolve();
        await initialized;
        expect(application.start).toHaveBeenCalledTimes(1);
    });

    it('disposes a retired renderer once and cannot resume it after lease release', async () => {
        const display = create();
        await display.init(canvas());
        const release = display.acquireRenderSuspension();
        display.destroy(); display.destroy();
        release(); display.acquireRenderSuspension()(); display.render();
        expect(application.stop).toHaveBeenCalledTimes(1);
        expect(application.start).toHaveBeenCalledTimes(1);
        expect(application.destroy).toHaveBeenCalledOnce();
        expect(application.render).not.toHaveBeenCalled();
        expect(display.captureThumbnailDataUrl()).toBeUndefined();
        await expect(display.init(canvas())).rejects.toThrow('destroyed');
        expect(application.init).toHaveBeenCalledTimes(1);
    });

    it('cannot start a retired initializer or attach its layers after completion', async () => {
        const display = create();
        const pending = deferred();
        application.init.mockReturnValueOnce(pending.promise);
        const initialized = display.init(canvas());
        const rejected = expect(initialized).rejects.toThrow('destroyed');
        const release = display.acquireRenderSuspension();
        display.destroy();
        pending.resolve();
        await rejected;
        release();
        expect(application.start).not.toHaveBeenCalled();
        expect(application.stage.addChild).not.toHaveBeenCalled();
        expect(application.destroy).toHaveBeenCalledOnce();
        expect(application.stop).not.toHaveBeenCalled();
    });

    it('does not start or render after failed initialization', async () => {
        const display = create();
        application.init.mockRejectedValueOnce(new Error('GPU unavailable'));
        await expect(display.init(canvas())).rejects.toThrow('GPU unavailable');
        display.acquireRenderSuspension()(); display.render(); display.destroy();
        expect(application.start).not.toHaveBeenCalled();
        expect(application.render).not.toHaveBeenCalled();
    });

    it('renders thumbnail pixels and restores the overlay without resuming a suspended ticker', async () => {
        const display = create();
        const context = { drawImage: vi.fn(), fillRect: vi.fn() };
        const thumbnail = { getContext: () => context, toDataURL: () => 'data:image/webp;base64,thumbnail' };
        const source = { ...canvas(), ownerDocument: { createElement: () => thumbnail } } as unknown as HTMLCanvasElement;
        await display.init(source);
        const release = display.acquireRenderSuspension();
        const overlay = display.getLayer('overlay');
        application.render.mockImplementation(() => {
            expect(overlay.visible).toBe(application.render.mock.calls.length !== 1);
        });
        expect(display.captureThumbnailDataUrl()).toBe('data:image/webp;base64,thumbnail');
        expect(context.drawImage).toHaveBeenCalled();
        expect(overlay.visible).toBe(true);
        expect(application.render).toHaveBeenCalledTimes(2);
        expect(application.start).toHaveBeenCalledTimes(1);
        release();
        expect(application.start).toHaveBeenCalledTimes(2);
    });
});
