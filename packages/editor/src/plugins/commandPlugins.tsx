import type { ComponentType, ReactNode } from 'react';

import { SchemaRegistry } from '@zeffuro/zerith-core/schemas';

import type { RegisterEditorPluginFunction } from './pluginDiscovery';
import type {
    BranchSpec,
    CommandPlugin,
    CommandPluginContribution,
    EditorCommandType,
    EditorNodeByType,
    EditorPluginCapability,
    EditorPluginContribution,
    EditorPluginManifest,
    NonMacroEditorCommandType,
    PluginAPI,
    PluginNode,
    RegisteredEditorPlugin,
} from './types';

import { PLUGIN_OVERRIDES } from './commands';
import { FALLBACK_ICON, titleCase } from './commands/shared';
import {
    getRegisteredEditorCommandTypes,
    getRegisteredNonMacroEditorCommandTypes,
    isRegisteredEditorCommandType,
    registerEditorCommandType,
    unregisterEditorCommandType,
} from './commandTypes';
import { notifyPluginRegistryChanged } from './pluginRegistryEvents';
import { CURRENT_EDITOR_PLUGIN_API_VERSION } from './types';

export type EditorPluginRegistrationOptions = {
    reservation?: symbol;
    source?: string;
};

type CommandOwner = {
    accepting: boolean;
    commands: Map<string, CommandPluginContribution['schema']>;
    id: string;
};

type CommandPluginMetadata = {
    createDefault?: () => PluginNode;
    getBranches?: (node: PluginNode) => BranchSpec[];
    getSummary?: (node: PluginNode) => string;
    icon?: (size: number) => ReactNode;
    Inspector?: ComponentType<{ index?: null | number | undefined; node: PluginNode; }>;
    label?: string;
    quickColor?: { bg: string; border: string };
};

type RegisteredEditorPluginInternal = {
    cleanup?: () => void;
    deactivate?: () => void;
    owner: CommandOwner;
} & RegisteredEditorPlugin;

type UnknownCommandPlugin = {
    createDefault?: () => PluginNode;
    getSummary?: (node: PluginNode) => string;
    icon: (size: number) => ReactNode;
    Inspector?: ComponentType<{ index?: number | undefined; node: PluginNode; }>;
    label: string;
    type: string;
};

const registeredEditorPlugins = new Map<string, RegisteredEditorPluginInternal>();
const registeredPluginMetadata = new Map<string, CommandPluginMetadata>();
const pluginCache = new Map<string, CommandPlugin>();
const commandOwners = new Map<string, CommandOwner>();
const pendingLoads = new Map<string, symbol>();
const transitioningPlugins = new Set<string>();

export function deactivateEditorPlugin(pluginId: string): boolean {
    const id = normalizePluginId(pluginId);
    const plugin = registeredEditorPlugins.get(id);
    if (!plugin || !plugin.active) {
        return false;
    }

    transitioningPlugins.add(id);
    releaseOwnedCommands(plugin.owner);
    registeredEditorPlugins.set(id, {
        ...plugin,
        active: false,
        cleanup: undefined,
    });
    try {
        runTeardownHooks(plugin.cleanup, plugin.deactivate);
    } finally {
        transitioningPlugins.delete(id);
        notifyPluginRegistryChanged();
    }
    return true;
}

export function getRegisteredEditorPlugins(): RegisteredEditorPlugin[] {
    return [...registeredEditorPlugins.values()]
        .map((plugin) => toPublicPluginSnapshot(plugin))
        .toSorted((left, right) => left.manifest.id.localeCompare(right.manifest.id));
}

export function registerCommandPlugin(
    contribution: CommandPluginContribution,
): CommandPlugin<NonMacroEditorCommandType> {
    return registerOwnedCommand(contribution);
}

export function registerEditorPlugin(
    contribution: EditorPluginContribution,
    options: EditorPluginRegistrationOptions = {},
): RegisteredEditorPlugin {
    const manifest = normalizePluginManifest(contribution.manifest);
    assertEditorPluginCompatibility(manifest);
    assertPluginAvailable(manifest.id, options.reservation);
    transitioningPlugins.add(manifest.id);
    const owner: CommandOwner = { accepting: true, commands: new Map(), id: manifest.id };
    let activationStarted = false;
    try {
        for (const command of contribution.commands ?? []) registerOwnedCommand(command, owner);
        const scopedApi: PluginAPI = {
            ...pluginApi,
            registerCommandPlugin: command => registerOwnedCommand(command, owner),
            registerPlugin: plugin => {
                assertOwnerAccepting(owner);
                return registerEditorPlugin(plugin);
            },
        };
        activationStarted = true;
        const activationResult = contribution.activate?.(scopedApi);
        if (activationResult !== undefined && typeof activationResult !== 'function') {
            void Promise.resolve(activationResult).catch(() => {});
            throw new TypeError(`Editor plugin '${manifest.id}' activation must be synchronous.`);
        }
        const snapshot: RegisteredEditorPluginInternal = {
            active: true,
            capabilities: resolvePluginCapabilities(contribution, [...owner.commands.keys()]),
            cleanup: typeof activationResult === 'function' ? activationResult : undefined,
            commandTypes: [...owner.commands.keys()],
            deactivate: contribution.deactivate,
            manifest,
            owner,
            ...(options.source === undefined ? {} : { source: options.source }),
        };
        registeredEditorPlugins.set(manifest.id, snapshot);
        return toPublicPluginSnapshot(snapshot);
    } catch (error) {
        releaseOwnedCommands(owner);
        if (activationStarted) {
            try { runTeardownHooks(contribution.deactivate); }
            catch (teardownError) {
                throw new AggregateError([error, teardownError], `${String(error)}; ${String(teardownError)}`, { cause: teardownError });
            }
        }
        throw error;
    } finally {
        transitioningPlugins.delete(manifest.id);
        notifyPluginRegistryChanged();
    }
}

function registerOwnedCommand(
    contribution: CommandPluginContribution,
    owner?: CommandOwner,
): CommandPlugin<NonMacroEditorCommandType> {
    const normalized = contribution.type.trim();
    const existingOwner = commandOwners.get(normalized);
    if (owner) assertOwnerAccepting(owner);
    if ((existingOwner && existingOwner !== owner)
        || (owner && existingOwner !== owner && isRegisteredEditorCommandType(normalized))) {
        throw new TypeError(`Command type '${normalized}' is already registered.`);
    }
    const type = registerEditorCommandType(contribution.type);

    if (owner) {
        commandOwners.set(type, owner);
        owner.commands.set(type, contribution.schema ?? owner.commands.get(type));
    }

    if (contribution.schema) {
        SchemaRegistry.register(type, contribution.schema);
    }

    const previousMetadata = registeredPluginMetadata.get(type) ?? {};
    registeredPluginMetadata.set(type, {
        ...previousMetadata,
        ...extractPluginMetadata(contribution),
    });
    pluginCache.delete(type);
    if (!owner || registeredEditorPlugins.get(owner.id)?.active) notifyPluginRegistryChanged();
    return ensurePlugin(type);
}

registerEditorPlugin.prepare = (pluginId: string): ReturnType<NonNullable<RegisterEditorPluginFunction['prepare']>> => {
    const id = normalizePluginId(pluginId);
    assertPluginAvailable(id);
    const reservation = Symbol(id);
    pendingLoads.set(id, reservation);
    return {
        register: (contribution, options) => {
            if (normalizePluginId(contribution.manifest.id) !== id || pendingLoads.get(id) !== reservation) {
                throw new TypeError(`Editor plugin '${id}' load reservation is no longer valid.`);
            }
            return registerEditorPlugin(contribution, { ...options, reservation });
        },
        release: () => { if (pendingLoads.get(id) === reservation) pendingLoads.delete(id); },
    };
};

function assertEditorPluginCompatibility(manifest: EditorPluginManifest): void {
    if (
        manifest.pluginApiVersion !== undefined
        && manifest.pluginApiVersion !== CURRENT_EDITOR_PLUGIN_API_VERSION
    ) {
        throw new TypeError(
            `Editor plugin '${manifest.id}' targets plugin API v${manifest.pluginApiVersion}, `
            + `but this editor supports v${CURRENT_EDITOR_PLUGIN_API_VERSION}.`
        );
    }
}

function assertOwnerAccepting(owner: CommandOwner): void {
    if (!owner.accepting) throw new TypeError(`Editor plugin '${owner.id}' is inactive.`);
}

function assertPluginAvailable(id: string, reservation?: symbol): void {
    if (registeredEditorPlugins.get(id)?.active || transitioningPlugins.has(id)
        || (pendingLoads.has(id) && pendingLoads.get(id) !== reservation)) {
        throw new TypeError(`Editor plugin '${id}' is already active or changing state.`);
    }
}

function buildPlugin(type: EditorCommandType): CommandPlugin {
    const builtInMetadata = PLUGIN_OVERRIDES[type];
    const registeredMetadata = registeredPluginMetadata.get(type);
    const metadata = {
        ...builtInMetadata,
        ...registeredMetadata,
    };

    return {
        createDefault: metadata.createDefault ?? (() => ({ type })),
        getBranches: metadata.getBranches,
        getSummary: metadata.getSummary,
        icon: metadata.icon ?? FALLBACK_ICON,
        Inspector: metadata.Inspector,
        label: metadata.label ?? titleCase(type),
        quickColor: metadata.quickColor,
        type,
    };
}

function ensurePlugin(type: EditorCommandType): CommandPlugin {
    const cached = pluginCache.get(type);
    if (cached) return cached;

    const plugin = buildPlugin(type);
    pluginCache.set(type, plugin);
    return plugin;
}

function extractPluginMetadata(contribution: CommandPluginContribution): CommandPluginMetadata {
    const metadata: CommandPluginMetadata = {};

    if (contribution.createDefault) metadata.createDefault = contribution.createDefault;
    if (contribution.getBranches) metadata.getBranches = contribution.getBranches;
    if (contribution.getSummary) metadata.getSummary = contribution.getSummary;
    if (contribution.icon) metadata.icon = contribution.icon;
    if (contribution.Inspector) metadata.Inspector = contribution.Inspector;
    if (contribution.label) metadata.label = contribution.label;
    if (contribution.quickColor) metadata.quickColor = contribution.quickColor;

    return metadata;
}

function normalizePluginId(id: string): string {
    const normalized = id.trim();
    if (!normalized) {
        throw new TypeError('Editor plugin id cannot be empty.');
    }
    return normalized;
}

function normalizePluginManifest(manifest: EditorPluginContribution['manifest']): EditorPluginContribution['manifest'] {
    const entry = manifest.entry?.trim();
    const id = normalizePluginId(manifest.id);
    const name = manifest.name.trim();
    const pluginApiVersion = manifest.pluginApiVersion;
    const version = manifest.version.trim();

    if (!name) {
        throw new TypeError(`Editor plugin '${id}' must declare a name.`);
    }

    if (!version) {
        throw new TypeError(`Editor plugin '${id}' must declare a version.`);
    }

    if (entry !== undefined && !entry) {
        throw new TypeError(`Editor plugin '${id}' entry cannot be empty.`);
    }

    return {
        ...manifest,
        ...(entry === undefined ? {} : { entry: entry.replaceAll('\\', '/') }),
        id,
        name,
        ...(pluginApiVersion === undefined ? {} : { pluginApiVersion }),
        version,
    };
}

function releaseOwnedCommands(owner: CommandOwner): void {
    owner.accepting = false;
    for (const [type, schema] of owner.commands) {
        if (commandOwners.get(type) !== owner) continue;
        commandOwners.delete(type);
        registeredPluginMetadata.delete(type);
        pluginCache.delete(type);
        unregisterEditorCommandType(type);
        if (schema && SchemaRegistry.get(type) === schema) delete SchemaRegistry.getRegistry()[type];
    }
}

function resolvePluginCapabilities(
    contribution: EditorPluginContribution,
    commandTypes: string[],
): EditorPluginCapability[] {
    const capabilities = new Set<EditorPluginCapability>(contribution.manifest.capabilities);
    if (commandTypes.length > 0) capabilities.add('commands');
    if (contribution.commands?.some((commandContribution) => commandContribution.Inspector)) {
        capabilities.add('inspectors');
    }

    return [...capabilities].toSorted((left, right) => left.localeCompare(right));
}

function runTeardownHooks(...hooks: (((() => void) | undefined))[]): void {
    const errors: unknown[] = [];
    for (const hook of hooks) {
        try {
            const result: unknown = hook?.();
            if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
                void Promise.resolve(result).catch(() => {});
                throw new TypeError('Editor plugin cleanup and deactivation must be synchronous.');
            }
        } catch (error) { errors.push(error); }
    }
    if (errors.length > 0) {
        throw new AggregateError(errors, errors.map(error => error instanceof Error ? error.message : String(error)).join('; '));
    }
}

function toPublicPluginSnapshot(plugin: RegisteredEditorPluginInternal): RegisteredEditorPlugin {
    const commandTypes = [...plugin.owner.commands.keys()];
    const capabilities = new Set(plugin.capabilities);
    if (commandTypes.length > 0) capabilities.add('commands');
    if (plugin.active && commandTypes.some(type => registeredPluginMetadata.get(type)?.Inspector)) capabilities.add('inspectors');
    return {
        active: plugin.active,
        capabilities: [...capabilities].toSorted(),
        commandTypes,
        manifest: { ...plugin.manifest },
        ...(plugin.source === undefined ? {} : { source: plugin.source }),
    };
}

export const pluginApi: PluginAPI = {
    createDefaultCommand<TType extends EditorCommandType>(type: TType) {
        return pluginApi.getPlugin(type).createDefault?.() ?? ({ type } as EditorNodeByType<TType>);
    },
    deactivatePlugin(pluginId) {
        return deactivateEditorPlugin(pluginId);
    },
    getAllPlugins() {
        return getRegisteredNonMacroEditorCommandTypes()
            .map((type) => ensurePlugin(type));
    },
    getCommandTypes() {
        return getRegisteredEditorCommandTypes();
    },
    getPlugin<TType extends EditorCommandType>(type: TType) {
        return ensurePlugin(type) as unknown as CommandPlugin<TType>;
    },
    getRegisteredPlugins() {
        return getRegisteredEditorPlugins();
    },
    registerCommandPlugin(contribution) {
        return registerCommandPlugin(contribution);
    },
    registerPlugin: registerEditorPlugin,
};

export function createDefaultCommand<TType extends EditorCommandType>(type: TType): EditorNodeByType<TType>;
export function createDefaultCommand(type: string): PluginNode;
export function createDefaultCommand(type: string): PluginNode {
    const plugin = getPlugin(type);
    return plugin.createDefault?.() ?? { type };
}

export function getAllPlugins(): CommandPlugin<NonMacroEditorCommandType>[] {
    return pluginApi.getAllPlugins();
}

export function getPlugin<TType extends EditorCommandType>(type: TType): CommandPlugin<TType>;
export function getPlugin(type: string): CommandPlugin | UnknownCommandPlugin;
export function getPlugin(type: string): CommandPlugin | UnknownCommandPlugin {
    if (isRegisteredEditorCommandType(type)) {
        return pluginApi.getPlugin(type);
    }
    return {
        createDefault: () => ({ type }),
        icon: FALLBACK_ICON,
        label: titleCase(type),
        type,
    };
}
