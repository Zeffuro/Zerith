import type { ComponentType, ReactNode } from 'react';

import { SchemaRegistry } from 'core/schemas';

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
} from './commandTypes';
import { CURRENT_EDITOR_PLUGIN_API_VERSION } from './types';

export type EditorPluginRegistrationOptions = {
    source?: string;
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

export function deactivateEditorPlugin(pluginId: string): boolean {
    const id = normalizePluginId(pluginId);
    const plugin = registeredEditorPlugins.get(id);
    if (!plugin || !plugin.active) {
        return false;
    }

    plugin.cleanup?.();
    plugin.deactivate?.();
    registeredEditorPlugins.set(id, {
        ...plugin,
        active: false,
        cleanup: undefined,
    });
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
    const type = registerEditorCommandType(contribution.type);

    if (contribution.schema) {
        SchemaRegistry.register(type, contribution.schema);
    }

    const previousMetadata = registeredPluginMetadata.get(type) ?? {};
    registeredPluginMetadata.set(type, {
        ...previousMetadata,
        ...extractPluginMetadata(contribution),
    });
    pluginCache.delete(type);

    return ensurePlugin(type);
}

export function registerEditorPlugin(
    contribution: EditorPluginContribution,
    options: EditorPluginRegistrationOptions = {},
): RegisteredEditorPlugin {
    const manifest = normalizePluginManifest(contribution.manifest);
    assertEditorPluginCompatibility(manifest);
    if (registeredEditorPlugins.has(manifest.id)) {
        throw new TypeError(`Editor plugin '${manifest.id}' is already registered.`);
    }

    const commandTypes = contribution.commands?.map((commandContribution) => (
        registerCommandPlugin(commandContribution).type
    )) ?? [];
    const capabilities = resolvePluginCapabilities(contribution, commandTypes);
    const activationResult = contribution.activate?.(pluginApi);
    const cleanup = typeof activationResult === 'function' ? activationResult : undefined;
    const snapshot: RegisteredEditorPluginInternal = {
        active: true,
        capabilities,
        cleanup,
        commandTypes,
        deactivate: contribution.deactivate,
        manifest,
        ...(options.source === undefined ? {} : { source: options.source }),
    };

    registeredEditorPlugins.set(manifest.id, snapshot);
    return toPublicPluginSnapshot(snapshot);
}

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

function toPublicPluginSnapshot(plugin: RegisteredEditorPluginInternal): RegisteredEditorPlugin {
    return {
        active: plugin.active,
        capabilities: [...plugin.capabilities],
        commandTypes: [...plugin.commandTypes],
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
    registerPlugin(contribution) {
        return registerEditorPlugin(contribution);
    },
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
