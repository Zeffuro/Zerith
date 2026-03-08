import type { CommandType } from 'core';
import type { ReactNode } from 'react';
import type React from 'react';

import type { EditorNode } from '../types/EditorNode';
import type { ScriptPath } from '../utils/scriptPathUtilities';

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

export type EditorCommandType = 'macro_header' | CommandType;

export type EditorNodeByType<TType extends EditorCommandType> = Extract<EditorNode, { type: TType }>;
export type NonMacroEditorCommandType = Exclude<EditorCommandType, 'macro_header'>;

export interface PluginAPI {
    createDefaultCommand: <TType extends EditorCommandType>(type: TType) => EditorNodeByType<TType>;
    getAllPlugins: () => CommandPlugin<NonMacroEditorCommandType>[];
    getCommandTypes: () => EditorCommandType[];
    getPlugin: <TType extends EditorCommandType>(type: TType) => CommandPlugin<TType>;
}

export type PluginInspectorProperties<TNode extends PluginNode = PluginNode> = {
    index?: null | number | undefined;
    node: TNode;
};

export type PluginNode = ({ type: string } & Record<string, unknown>) | EditorNode;


