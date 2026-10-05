import type { Engine } from './Engine';
import type {
    RegisteredRuntimePlugin, RuntimePlugin, RuntimePluginCleanup,
    RuntimePluginContext, RuntimePluginManifest,
} from './types/RuntimePlugin';

import { onceCleanup, RuntimePluginContributions } from './runtimePluginContributions';
import { CURRENT_RUNTIME_PLUGIN_API_VERSION } from './types/RuntimePlugin';

interface Registration {
    activationCleanup?: RuntimePluginCleanup;
    activationComplete: boolean;
    closed: boolean;
    contributions: RuntimePluginCleanup[];
    disposal?: Promise<void>;
    manifest: RuntimePluginManifest;
    plugin: RuntimePlugin;
    resourceDisposal?: Promise<void>;
}

export class RuntimePluginRegistry {
    private readonly contributions: RuntimePluginContributions;
    private destroyed = false;
    private readonly engine: Engine;
    private readonly registrations = new Map<string, Registration>();

    constructor(engine: Engine) {
        this.engine = engine;
        this.contributions = new RuntimePluginContributions(engine.flow, engine.overlay);
    }

    public async deactivate(id: string): Promise<boolean> {
        const registration = this.registrations.get(normalizeId(id));
        if (!registration || registration.closed) return false;
        this.close(registration);
        await (registration.activationComplete ? this.finishDisposal(registration) : registration.resourceDisposal);
        return true;
    }

    public destroy(): Promise<void> {
        this.destroyed = true;
        const registrations = [...this.registrations.values()];
        // Revoke every context and detach every contribution before any hook yields.
        for (const registration of registrations) this.close(registration);
        return Promise.all(registrations.map(registration => registration.activationComplete
            ? this.finishDisposal(registration) : registration.resourceDisposal ?? Promise.resolve())).then(() => {});
    }

    public getRegistered(): RegisteredRuntimePlugin[] {
        return [...this.registrations.values()].filter(registration => registration.activationComplete && !registration.closed)
            .map(registration => snapshot(registration)).toSorted((left, right) => left.manifest.id.localeCompare(right.manifest.id));
    }

    public async register(plugin: RuntimePlugin): Promise<RegisteredRuntimePlugin> {
        if (this.destroyed) throw new Error('The engine has been destroyed.');
        const manifest = normalizeManifest(plugin.manifest);
        if (manifest.pluginApiVersion !== undefined && manifest.pluginApiVersion !== CURRENT_RUNTIME_PLUGIN_API_VERSION) {
            throw new TypeError(`Runtime plugin '${manifest.id}' targets plugin API v${manifest.pluginApiVersion}, but this runtime supports v${CURRENT_RUNTIME_PLUGIN_API_VERSION}.`);
        }
        if (this.registrations.has(manifest.id)) throw new TypeError(`Runtime plugin '${manifest.id}' is already registered.`);
        const registration: Registration = { activationComplete: false, closed: false, contributions: [], manifest, plugin: { ...plugin, manifest } };
        this.registrations.set(manifest.id, registration);
        try {
            const result = await plugin.activate(this.createContext(registration));
            const cleanup = typeof result === 'function' ? result : result?.cleanup ?? result?.dispose;
            if (cleanup) registration.activationCleanup = onceCleanup(cleanup);
        } catch (error) {
            this.close(registration);
            await registration.resourceDisposal;
            this.release(registration);
            throw error;
        }
        registration.activationComplete = true;
        if (registration.closed || this.destroyed) {
            this.close(registration);
            await this.finishDisposal(registration);
            throw new Error(`Runtime plugin '${manifest.id}' activation was cancelled.`);
        }
        return snapshot(registration);
    }

    private close(registration: Registration): void {
        if (registration.closed) return;
        registration.closed = true;
        const pending = registration.contributions.toReversed().map(cleanup => this.runCleanup(registration, cleanup));
        registration.resourceDisposal = Promise.all(pending).then(() => {});
    }

    private createContext(registration: Registration): RuntimePluginContext {
        const assertOpen = () => {
            if (this.destroyed || registration.closed) throw new Error(`Runtime plugin '${registration.manifest.id}' context is inactive.`);
        };
        return {
            engine: this.engine,
            manifest: { ...registration.manifest, capabilities: [...(registration.manifest.capabilities ?? [])] },
            registerHandler: handler => {
                assertOpen();
                const cleanup = this.contributions.registerHandler(handler);
                registration.contributions.push(cleanup);
                return cleanup;
            },
            registerPanel: panel => {
                assertOpen();
                const cleanup = this.contributions.registerPanel(panel);
                registration.contributions.push(cleanup);
                return cleanup;
            },
        };
    }

    private finishDisposal(registration: Registration): Promise<void> {
        registration.disposal ??= Promise.resolve().then(async () => {
            if (registration.plugin.deactivate) await this.runCleanup(registration, () => registration.plugin.deactivate?.());
            if (registration.activationCleanup) await this.runCleanup(registration, registration.activationCleanup);
            await registration.resourceDisposal;
            this.release(registration);
        });
        return registration.disposal;
    }

    private release(registration: Registration): void {
        if (this.registrations.get(registration.manifest.id) === registration) this.registrations.delete(registration.manifest.id);
    }

    private async runCleanup(registration: Registration, cleanup: RuntimePluginCleanup): Promise<void> {
        try {
            await cleanup();
        } catch (error) {
            this.engine.logger.error(`Runtime plugin '${registration.manifest.id}' cleanup failed: ${String(error)}`);
        }
    }
}

function normalizeId(id: string): string {
    const normalized = id.trim();
    if (!normalized) throw new TypeError('Runtime plugin id cannot be empty.');
    return normalized;
}

function normalizeManifest(manifest: RuntimePluginManifest): RuntimePluginManifest {
    const id = normalizeId(manifest.id);
    const name = manifest.name.trim();
    const version = manifest.version.trim();
    if (!name) throw new TypeError(`Runtime plugin '${id}' must declare a name.`);
    if (!version) throw new TypeError(`Runtime plugin '${id}' must declare a version.`);
    return { ...manifest, capabilities: [...new Set(manifest.capabilities)].toSorted((left, right) => left.localeCompare(right)), id, name, version };
}

function snapshot(registration: Registration): RegisteredRuntimePlugin {
    const capabilities = [...(registration.manifest.capabilities ?? [])];
    return { active: true, capabilities, manifest: { ...registration.manifest, capabilities: [...capabilities] } };
}
