import type { Engine } from '../Engine';
import type { RegisteredCommandHandler } from '../interfaces/ICommandHandler';
import type { MenuPanel } from './MenuPanel';

export const CURRENT_RUNTIME_PLUGIN_API_VERSION = 1 as const;

export interface RegisteredRuntimePlugin {
    active: boolean;
    capabilities: RuntimePluginCapability[];
    manifest: RuntimePluginManifest;
}

export interface RuntimePlugin {
    activate(context: RuntimePluginContext): Promise<RuntimePluginActivationResult> | RuntimePluginActivationResult;
    deactivate?(): Promise<void> | void;
    manifest: RuntimePluginManifest;
}

export type RuntimePluginActivationResult =
    | {
        cleanup?: RuntimePluginCleanup;
        dispose?: RuntimePluginCleanup;
    }
    | RuntimePluginCleanup
    | void;

export type RuntimePluginCapability =
    | 'commands'
    | 'events'
    | 'overlays'
    | 'state';

export type RuntimePluginCleanup = () => Promise<void> | void;

export interface RuntimePluginContext {
    engine: Engine;
    manifest: RuntimePluginManifest;
    registerHandler(handler: RegisteredCommandHandler): RuntimePluginCleanup;
    registerPanel(panel: MenuPanel): RuntimePluginCleanup;
}

export interface RuntimePluginManifest {
    capabilities?: RuntimePluginCapability[];
    engineVersion?: string;
    id: string;
    name: string;
    pluginApiVersion?: number;
    version: string;
}
