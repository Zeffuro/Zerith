import type { Command } from 'core';

export type MacroHeaderNode = {
    type: 'macro_header';
    name: string;
    body: Command[];
};

export type EditorNode = Command | MacroHeaderNode;

