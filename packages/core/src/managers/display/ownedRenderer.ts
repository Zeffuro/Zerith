import type { ApplicationOptions, CanvasOptions, Renderer, RendererConfig, RendererDestroyOptions, RendererPreference, WebGLOptions, WebGPUOptions } from 'pixi.js';

import { CanvasRenderer, DOMAdapter, EventSystem, isWebGLSupported, loadEnvironmentExtensions, WebGLRenderer, WebGPURenderer } from 'pixi.js';

import { createOwnedEventSystem } from './OwnedEventSystem';

const defaultOrder: RendererPreference[] = ['webgl', 'webgpu', 'canvas'];

class OwnedCanvasRenderer extends CanvasRenderer {
    private readonly isRetired: () => boolean;
    constructor(isRetired: () => boolean) {
        super();
        this.isRetired = isRetired;
    }

    public override async init(options: Partial<CanvasOptions> = {}): Promise<void> {
        this.config = await prepareOwnedConfig(this.config, options, this.isRetired);
        await super.init({ ...options, skipExtensionImports: true });
    }
}

class OwnedWebGLRenderer extends WebGLRenderer {
    private readonly isRetired: () => boolean;
    constructor(isRetired: () => boolean) {
        super();
        this.isRetired = isRetired;
    }

    public override async init(options: Partial<WebGLOptions> = {}): Promise<void> {
        this.config = await prepareOwnedConfig(this.config, options, this.isRetired);
        await super.init({ ...options, skipExtensionImports: true });
    }
}

class OwnedWebGPURenderer extends WebGPURenderer {
    private readonly isRetired: () => boolean;
    constructor(isRetired: () => boolean) {
        super();
        this.isRetired = isRetired;
    }

    public override async init(options: Partial<WebGPUOptions> = {}): Promise<void> {
        this.config = await prepareOwnedConfig(this.config, options, this.isRetired);
        await super.init({ ...options, skipExtensionImports: true });
    }
}

export function assertCurrent(isRetired: () => boolean): void {
    if (isRetired()) throw new Error('Application is destroyed');
}

export function attempt(action: () => void, errors: unknown[]): void {
    try {
        action();
    } catch (error) {
        errors.push(error);
    }
}

export async function createOwnedRenderer(
    options: Partial<ApplicationOptions>,
    isRetired: () => boolean,
): Promise<{ options: Partial<ApplicationOptions>; renderer: Renderer }> {
    const preferred = options.preference;
    const order = Array.isArray(preferred) ? [...preferred]
        : (preferred ? [preferred, ...defaultOrder.filter(type => type !== preferred)] : defaultOrder);
    for (const type of order) {
        assertCurrent(isRetired);
        if (type === 'webgl' && isWebGLSupported(options.failIfMajorPerformanceCaveat)) {
            assertCurrent(isRetired);
            return { options: backendOptions(options, type), renderer: new OwnedWebGLRenderer(isRetired) };
        }
        if (type === 'webgpu' && await supportsOwnedWebGPU()) {
            assertCurrent(isRetired);
            return { options: backendOptions(options, type), renderer: new OwnedWebGPURenderer(isRetired) };
        }
        if (type === 'canvas') {
            assertCurrent(isRetired);
            return { options: backendOptions(options, type), renderer: new OwnedCanvasRenderer(isRetired) };
        }
    }
    assertCurrent(isRetired);
    throw new Error('No available renderer for the current environment');
}

export function destroyOwnedRenderer(renderer: Renderer, errors: unknown[]): void {
    const webgl = renderer instanceof WebGLRenderer ? renderer : undefined;
    const context = webgl?.context as unknown as { gl?: WebGLRenderingContext } | undefined;
    const gl = webgl?.gl ?? context?.gl;
    const destroyRunner = renderer.runners.destroy;
    const participants = destroyRunner.items as unknown as { destroy(options: RendererDestroyOptions): void }[];
    for (const participant of participants.toReversed()) {
        destroyRunner.remove(participant);
        attempt(() => participant.destroy({ releaseGlobalResources: false, removeView: false }), errors);
    }
    attempt(() => renderer.destroy({ releaseGlobalResources: false, removeView: false }), errors);
    if (gl) {
        attempt(() => {
            if (!gl.isContextLost()) gl.getExtension('WEBGL_lose_context')?.loseContext();
        }, errors);
    }
}

function backendOptions(options: Partial<ApplicationOptions>, type: RendererPreference): Partial<ApplicationOptions> {
    const result = { ...options, ...options[type === 'canvas' ? 'canvasOptions' : type] };
    delete result.webgl;
    delete result.webgpu;
    delete result.canvasOptions;
    return result;
}

function ownedSystems(config: RendererConfig, isRetired: () => boolean): RendererConfig {
    const OwnedEvents = createOwnedEventSystem(isRetired);
    return {
        ...config,
        systems: config.systems.map(system => (system.value as unknown) === EventSystem
            ? { ...system, value: OwnedEvents as unknown as RendererConfig['systems'][number]['value'] } : system),
    };
}

async function prepareOwnedConfig(config: RendererConfig, options: Partial<ApplicationOptions>, isRetired: () => boolean): Promise<RendererConfig> {
    const skip = options.skipExtensionImports === true || options.manageImports === false;
    await loadEnvironmentExtensions(skip);
    assertCurrent(isRetired);
    if (!skip && config.loaders) await Promise.all(config.loaders.map(loader => loader.value.load()));
    assertCurrent(isRetired);
    return ownedSystems(config, isRetired);
}

async function supportsOwnedWebGPU(): Promise<boolean> {
    const gpu = DOMAdapter.get().getNavigator().gpu;
    if (!gpu) return false;
    let device: GPUDevice | undefined;
    try {
        const adapter = await gpu.requestAdapter();
        if (!adapter) return false;
        device = await adapter.requestDevice();
        return true;
    } catch {
        return false;
    } finally {
        device?.destroy();
    }
}
