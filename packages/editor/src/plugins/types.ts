import type { CommandType } from '@zeffuro/zerith-core';
import type { ReactNode } from 'react';
import type React from 'react';
import type { z } from 'zod';

import type { EditorNode } from '../types/EditorNode';
import type { ScriptPath } from '../utils/scriptPathUtilities';

export const CURRENT_EDITOR_PLUGIN_API_VERSION = 1 as const;

export type BranchSpec<TNode extends PluginNode = PluginNode> = {
    label: string;
    nodes: TNode[];
    path: ScriptPath;
};
export type CommandPlugin<TType extends EditorCommandType = EditorCommandType> = {
    createDefault?: () => EditorNodeByType<TType>;
    getBranches?: (node: EditorNodeByType<TType>) => BranchSpec[];
    getSummary?: (node: EditorNodeByType<TType>) => string;
    icon: (size: number) => ReactNode;
    Inspector?: React.ComponentType<PluginInspectorProperties>;
    label: string;
    quickColor?: { bg: string; border: string };
    type: TType;
};

export type CommandPluginContribution = {
    createDefault?: () => PluginNode;
    getBranches?: (node: PluginNode) => BranchSpec[];
    getSummary?: (node: PluginNode) => string;
    icon?: (size: number) => ReactNode;
    Inspector?: React.ComponentType<PluginInspectorProperties>;
    label?: string;
    quickColor?: { bg: string; border: string };
    schema?: z.ZodType;
    type: string;
};

export type EditorCommandType = 'macro_header' | CommandType;

export type EditorNodeByType<TType extends EditorCommandType> =
    [BuiltInEditorNodeByType<TType>] extends [never]
        ? { type: TType } & Record<string, unknown>
        : BuiltInEditorNodeByType<TType>;

export type EditorPluginCapability =
    | 'commands'
    | 'graphNodes'
    | 'inspectors'
    | 'templates'
    | 'toolbarActions'
    | 'validators';

export type EditorPluginContribution = {
    activate?: (api: PluginAPI) => (() => void) | void;
    commands?: CommandPluginContribution[];
    deactivate?: () => void;
    manifest: EditorPluginManifest;
};

export type EditorPluginManifest = {
    capabilities?: EditorPluginCapability[];
    description?: string;
    entry?: string;
    id: string;
    name: string;
    pluginApiVersion?: number;
    version: string;
    zerithVersion?: string;
};

export type NonMacroEditorCommandType = Exclude<EditorCommandType, 'macro_header'>;
export interface PluginAPI {
    createDefaultCommand: <TType extends EditorCommandType>(type: TType) => EditorNodeByType<TType>;
    deactivatePlugin: (pluginId: string) => boolean;
    getAllPlugins: () => CommandPlugin<NonMacroEditorCommandType>[];
    getCommandTypes: () => EditorCommandType[];
    getPlugin: <TType extends EditorCommandType>(type: TType) => CommandPlugin<TType>;
    getRegisteredPlugins: () => RegisteredEditorPlugin[];
    registerCommandPlugin: (contribution: CommandPluginContribution) => CommandPlugin<NonMacroEditorCommandType>;
    registerPlugin: (contribution: EditorPluginContribution) => RegisteredEditorPlugin;
}

export type PluginInspectorProperties<TNode extends PluginNode = PluginNode> = {
    index?: null | number | undefined;
    node: TNode;
};

export type PluginNode = ({ type: string } & Record<string, unknown>) | EditorNode;

export type RegisteredEditorPlugin = {
    active: boolean;
    capabilities: EditorPluginCapability[];
    commandTypes: string[];
    manifest: EditorPluginManifest;
    source?: string;
};

type BuiltInEditorNodeByType<TType extends EditorCommandType> = Extract<EditorNode, { type: TType }>;


