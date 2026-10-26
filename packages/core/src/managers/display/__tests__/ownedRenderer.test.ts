import type { Renderer, RendererConfig } from 'pixi.js';

import { CanvasRenderer, EventsTicker, EventSystem, extensions, ExtensionType, GlContextSystem, WebGLRenderer, WebGPURenderer } from 'pixi.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createOwnedRenderer, destroyOwnedRenderer } from '../ownedRenderer';

const capability = vi.hoisted(() => vi.fn());
const environment = vi.hoisted(() => vi.fn());
vi.mock('pixi.js', async importOriginal => ({
    ...await importOriginal<typeof import('pixi.js')>(),
    isWebGLSupported: capability,
    loadEnvironmentExtensions: environment,
}));

function gpuProbe() {
    const device = { destroy: vi.fn() };
    const adapter = { requestDevice: vi.fn().mockResolvedValue(device) };
    const gpu = { requestAdapter: vi.fn().mockResolvedValue(adapter) };
    vi.stubGlobal('navigator', { gpu });
    return { adapter, device, gpu };
}

describe('owned renderer selection and failure cleanup', () => {
    beforeEach(() => {
        capability.mockReset(); capability.mockReturnValue(true);
        environment.mockReset(); environment.mockImplementation(() => Promise.resolve());
        vi.stubGlobal('navigator', {});
    });
    afterEach(() => vi.unstubAllGlobals());

    it('uses WebGL first and applies only its backend options', async () => {
        const probe = gpuProbe();
        const selected = await createOwnedRenderer({ backgroundColor: 1, canvasOptions: { backgroundColor: 2 }, webgl: { backgroundColor: 3 } }, () => false);
        expect(selected.renderer).toBeInstanceOf(WebGLRenderer);
        expect(selected.options.backgroundColor).toBe(3);
        expect(selected.options).not.toHaveProperty('webgl');
        expect(selected.options).not.toHaveProperty('canvasOptions');
        expect(probe.gpu.requestAdapter).not.toHaveBeenCalled();
        selected.renderer.destroy(false);
    });

    it('selects WebGPU when WebGL is unavailable and destroys the owned capability probe device', async () => {
        capability.mockReturnValue(false);
        const probe = gpuProbe();
        const selected = await createOwnedRenderer({ webgpu: { backgroundColor: 4 } }, () => false);
        expect(selected.renderer).toBeInstanceOf(WebGPURenderer);
        expect(selected.options.backgroundColor).toBe(4);
        expect(probe.device.destroy).toHaveBeenCalledTimes(1);
        selected.renderer.destroy(false);
    });

    it('selects Canvas when the GPU adapter cannot create a device', async () => {
        capability.mockReturnValue(false);
        const probe = gpuProbe();
        probe.adapter.requestDevice.mockRejectedValue(new Error('device unavailable'));
        const selected = await createOwnedRenderer({ canvasOptions: { backgroundColor: 5 } }, () => false);
        expect(selected.renderer).toBeInstanceOf(CanvasRenderer);
        expect(selected.options.backgroundColor).toBe(5);
        expect(probe.device.destroy).not.toHaveBeenCalled();
        selected.renderer.destroy(false);
    });

    it('honors an explicit preference blocklist rather than adding an excluded backend', async () => {
        const probe = gpuProbe();
        const selected = await createOwnedRenderer({ preference: ['canvas'] }, () => false);
        expect(selected.renderer).toBeInstanceOf(CanvasRenderer);
        expect(capability).not.toHaveBeenCalled();
        expect(probe.gpu.requestAdapter).not.toHaveBeenCalled();
        selected.renderer.destroy(false);
        await expect(createOwnedRenderer({ preference: [] }, () => false)).rejects.toThrow('No available renderer');
    });

    it('destroys a late probe device and constructs no renderer after retirement during capability detection', async () => {
        capability.mockReturnValue(false);
        const probe = gpuProbe();
        let resolve!: (device: typeof probe.device) => void;
        probe.adapter.requestDevice.mockReturnValue(new Promise(complete => { resolve = complete; }));
        let retired = false;
        const selected = createOwnedRenderer({}, () => retired);
        const rejected = expect(selected).rejects.toThrow('destroyed');
        await vi.waitFor(() => expect(probe.adapter.requestDevice).toHaveBeenCalled());
        retired = true;
        resolve(probe.device);
        await rejected;
        expect(probe.device.destroy).toHaveBeenCalledTimes(1);
    });

    it('cleans a renderer that failed before any systems were constructed', () => {
        const renderer = new WebGLRenderer();
        const errors: unknown[] = [];
        destroyOwnedRenderer(renderer, errors);
        expect(errors).toEqual([]);
        expect(renderer.renderPipes).toBeNull();
        expect(renderer.runners.destroy.items).toBeNull();
    });

    it('includes environment systems registered during imports and scopes the first real EventSystem', async () => {
        const selected = await createOwnedRenderer({}, () => false);
        const config = (selected.renderer as unknown as { config: RendererConfig }).config;
        const previouslyRegistered = config.systems.some(system => system.name === 'events');
        environment.mockImplementation(() => { extensions.add(EventSystem); return Promise.resolve(); });
        try {
            await expect(selected.renderer.init({})).rejects.toThrow();
            expect(selected.renderer.events).toBeInstanceOf(EventSystem);
            expect(selected.renderer.events.constructor).not.toBe(EventSystem);
            const successor = new EventSystem({} as Renderer);
            const errors: unknown[] = [];
            destroyOwnedRenderer(selected.renderer, errors);
            expect(EventsTicker.events).toBe(successor);
            successor.destroy();
        } finally {
            EventsTicker.destroy();
            if (!previouslyRegistered) extensions.remove(EventSystem);
        }
    });

    it('does not construct systems after retirement while environment loading is pending', async () => {
        let resolve!: () => void;
        environment.mockReturnValue(new Promise<void>(complete => { resolve = complete; }));
        let retired = false;
        const selected = await createOwnedRenderer({}, () => retired);
        const initializing = selected.renderer.init({});
        const rejected = expect(initializing).rejects.toThrow('destroyed');
        retired = true;
        resolve();
        await rejected;
        expect(selected.renderer.runners.destroy.items).toHaveLength(0);
        const errors: unknown[] = [];
        destroyOwnedRenderer(selected.renderer, errors);
        expect(errors).toEqual([]);
    });

    it('includes systems registered by backend loaders before cloning the owned configuration', async () => {
        const selected = await createOwnedRenderer({}, () => false);
        const config = (selected.renderer as unknown as { config: RendererConfig }).config;
        const previouslyRegistered = config.systems.some(system => system.name === 'events');
        const loader = {
            extension: { name: 'owned-renderer-test', type: ExtensionType.WebGLLoader },
            load: vi.fn(() => { extensions.add(EventSystem); return Promise.resolve(); }),
        };
        environment.mockImplementation(() => { extensions.add(loader); return Promise.resolve(); });
        try {
            await expect(selected.renderer.init({})).rejects.toThrow();
            expect(loader.load).toHaveBeenCalledTimes(1);
            expect(selected.renderer.events).toBeInstanceOf(EventSystem);
            expect(selected.renderer.events.constructor).not.toBe(EventSystem);
            destroyOwnedRenderer(selected.renderer, []);
        } finally {
            EventsTicker.destroy();
            extensions.remove(loader);
            if (!previouslyRegistered) extensions.remove(EventSystem);
        }
    });

    it('releases the owned GL context even when its real partial destructor throws', () => {
        const renderer = new WebGLRenderer();
        const lost = { loseContext: vi.fn() };
        const gl = {
            getExtension: vi.fn(() => lost), isContextLost: vi.fn(() => false),
            useProgram: vi.fn(() => { throw new Error('partial context cleanup'); }),
        };
        const canvas = { removeEventListener: vi.fn() };
        Object.assign(renderer, { gl, view: { canvas } });
        const context = new GlContextSystem(renderer);
        Object.assign(context, { extensions: { loseContext: lost }, gl });
        Object.assign(renderer, { context });
        renderer.runners.destroy.add(context);
        const remaining = { destroy: vi.fn() };
        renderer.runners.destroy.items.unshift(remaining);
        const errors: unknown[] = [];
        destroyOwnedRenderer(renderer, errors);
        expect(errors).toHaveLength(1);
        expect((errors[0] as Error).message).toBe('partial context cleanup');
        expect(canvas.removeEventListener).toHaveBeenCalledTimes(2);
        expect(remaining.destroy).toHaveBeenCalledTimes(1);
        expect(lost.loseContext).toHaveBeenCalledTimes(1);
        expect(renderer.renderPipes).toBeNull();
    });

    it('does not repeat GL context loss once the regular context destructor released it', () => {
        const renderer = new WebGLRenderer();
        const gl = { getExtension: vi.fn(), isContextLost: vi.fn(() => true) };
        Object.assign(renderer, { gl });
        const errors: unknown[] = [];
        destroyOwnedRenderer(renderer, errors);
        expect(errors).toEqual([]);
        expect(gl.getExtension).not.toHaveBeenCalled();
    });
});
