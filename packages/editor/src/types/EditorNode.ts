import type { Command } from 'zerith-core';

export type EditorNode = Command | MacroHeaderNode;

export type MacroHeaderNode = {
    body: Command[];
    name: string;
    type: 'macro_header';
};

