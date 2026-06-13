import type { ComponentType, ReactNode } from 'react';

import { BuiltInCommandTypes } from 'core';
import { SchemaRegistry } from 'core/schemas';

import type {
    CommandPlugin,
    EditorCommandType,
    EditorNodeByType,
    NonMacroEditorCommandType,
    PluginAPI,
    PluginNode,
} from './types';

import { PLUGIN_OVERRIDES } from './commands';
import { FALLBACK_ICON, titleCase } from './commands/shared';

type UnknownCommandPlugin = {
    createDefault?: () => PluginNode;
    getSummary?: (node: PluginNode) => string;
    icon: (size: number) => ReactNode;
    Inspector?: ComponentType<{ index?: number | undefined; node: PluginNode; }>;
    label: string;
    type: string;
};


const editorCommandTypeSet = new Set<EditorCommandType>([...BuiltInCommandTypes, 'macro_header']);

function isEditorCommandType(type: string): type is EditorCommandType {
    return editorCommandTypeSet.has(type);
}

export const COMMAND_TYPES: EditorCommandType[] = [...new Set([
    ...SchemaRegistry.getTypes(),
    'macro_header',
])].filter((type) => isEditorCommandType(type));

export const COMMAND_PLUGINS: Record<EditorCommandType, CommandPlugin> = Object.fromEntries(
    COMMAND_TYPES.map((type) => {
        const o = PLUGIN_OVERRIDES[type] ?? {};
        return [
            type,
            {
                createDefault: o.createDefault ?? (() => ({ type })),
                getBranches: o.getBranches,
                getSummary: o.getSummary,
                icon: o.icon ?? FALLBACK_ICON,
                Inspector: o.Inspector,
                label: o.label ?? titleCase(type),
                quickColor: o.quickColor,
                type,
            },
        ];
    })
) as Record<EditorCommandType, CommandPlugin>;

const typedCommandTypes = [...COMMAND_TYPES];

export const pluginApi: PluginAPI = {
    createDefaultCommand<TType extends EditorCommandType>(type: TType) {
        return pluginApi.getPlugin(type).createDefault?.() ?? ({ type } as EditorNodeByType<TType>);
    },
    getAllPlugins() {
        return typedCommandTypes
            .filter((type): type is NonMacroEditorCommandType => type !== 'macro_header')
            .map((type) => COMMAND_PLUGINS[type] as CommandPlugin<NonMacroEditorCommandType>);
    },
    getCommandTypes() {
        return [...typedCommandTypes];
    },
    getPlugin<TType extends EditorCommandType>(type: TType) {
        return COMMAND_PLUGINS[type] as unknown as CommandPlugin<TType>;
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
    if (isEditorCommandType(type)) {
        return pluginApi.getPlugin(type);
    }
    return {
        createDefault: () => ({ type }),
        icon: FALLBACK_ICON,
        label: titleCase(type),
        type,
    };
}
