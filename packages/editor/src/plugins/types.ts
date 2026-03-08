import type { ReactNode } from 'react';
import type React from 'react';
import type { CommandType } from 'core';
import type { EditorNode } from '../types/EditorNode';
import type { ScriptPath } from '../utils/scriptPathUtils';

export type EditorCommandType = CommandType | 'macro_header';
export type NonMacroEditorCommandType = Exclude<EditorCommandType, 'macro_header'>;

export type EditorNodeByType<TType extends EditorCommandType> = Extract<EditorNode, { type: TType }>;

export type PluginNode = ({ type: string } & Record<string, unknown>) | EditorNode;
export type PluginInspectorProps<TNode extends PluginNode = PluginNode> = {
    node: TNode;
    index?: number | null;
};

export type BranchSpec<TNode extends PluginNode = PluginNode> = {
    label: string;
    path: ScriptPath;
    nodes: TNode[];
};

export type CommandPlugin<TType extends EditorCommandType = EditorCommandType> = {
    type: TType;
    label: string;
    icon: (size: number) => ReactNode;
    quickColor?: { bg: string; border: string };
    createDefault?: () => EditorNodeByType<TType>;
    getSummary?: (node: EditorNodeByType<TType>) => string;
    getBranches?: (node: EditorNodeByType<TType>) => BranchSpec[];
    Inspector?: React.ComponentType<PluginInspectorProps<EditorNodeByType<TType>>>;
};

export interface PluginAPI {
    getPlugin: <TType extends EditorCommandType>(type: TType) => CommandPlugin<TType>;
    getAllPlugins: () => CommandPlugin<NonMacroEditorCommandType>[];
    createDefaultCommand: <TType extends EditorCommandType>(type: TType) => EditorNodeByType<TType>;
    getCommandTypes: () => EditorCommandType[];
}

