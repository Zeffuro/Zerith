import { ArrowRightCircle, GitFork, Repeat, Sigma, Workflow } from 'lucide-react';

import { editorTheme as t } from '../../theme/editorTheme';

import type { EditorNodeByType, PluginNode } from '../types';

import { CallInspector } from '../../components/inspector/CallInspector';
import { ForInspector } from '../../components/inspector/ForInspector';
import { GotoInspector } from '../../components/inspector/GotoInspector';
import { IfInspector } from '../../components/inspector/IfInspector';
import { JumpInspector } from '../../components/inspector/JumpInspector';
import { LabelInspector } from '../../components/inspector/LabelInspector';
import { MacroHeaderInspector } from '../../components/inspector/MacroHeaderInspector';
import { WhileInspector } from '../../components/inspector/WhileInspector';
import { asInspector, type CommandPluginOverrides, readArray, readNumber, readString } from './shared';

export const flowPluginOverrides: CommandPluginOverrides = {
    call: {
        createDefault: () => ({ name: '', type: 'call' }),
        getSummary: (node) => readString(node, 'name'),
        icon: (size) => <Workflow color={t.accent.purple} size={size} />,
        Inspector: CallInspector,
        quickColor: { bg: t.bg.panelAlt, border: t.accent.purple },
    },
    for: {
        createDefault: () => ({ body: [], from: 0, iterator: 'i', step: 1, to: 3, type: 'for' }),
        getBranches: (node) => [{ label: 'BODY', nodes: readArray<PluginNode>(node, 'body'), path: ['body'] }],
        getSummary: (node) => {
            const iterator = readString(node, 'iterator', 'i');
            const from = readNumber(node, 'from', 0);
            const to = readNumber(node, 'to', 0);
            const step = readNumber(node, 'step', 1);
            return `${iterator}: ${from}→${to} step ${step}`;
        },
        icon: (size) => <Sigma color="#60a5fa" size={size} />,
        Inspector: asInspector(ForInspector),
        quickColor: { bg: t.bg.panelAlt, border: t.accent.blue },
    },
    goto: {
        createDefault: () => ({ label: '', type: 'goto' }),
        Inspector: asInspector(GotoInspector),
    },
    if: {
        createDefault: () => {
            const command: Record<string, unknown> = {
                key: '',
                onFalse: [],
                onTrue: [],
                op: 'eq',
                source: 'variable',
                type: 'if',
                value: true,
            };
            return command as EditorNodeByType<'if'>;
        },
        getBranches: (node) => [
            { label: 'ON TRUE', nodes: readArray<PluginNode>(node, 'onTrue'), path: ['onTrue'] },
            { label: 'ON FALSE', nodes: readArray<PluginNode>(node, 'onFalse'), path: ['onFalse'] },
        ],
        getSummary: (node) => readString(node, 'key'),
        icon: (size) => <GitFork color={t.accent.teal} size={size} />,
        Inspector: asInspector(IfInspector),
        quickColor: { bg: t.bg.panelAlt, border: t.accent.teal },
    },
    jump: {
        createDefault: () => ({ to: '', type: 'jump' }),
        getSummary: (node) => readString(node, 'to'),
        icon: (size) => <ArrowRightCircle color={t.accent.yellow} size={size} />,
        Inspector: asInspector(JumpInspector),
        quickColor: { bg: t.bg.panelAlt, border: t.accent.yellow },
    },
    label: {
        createDefault: () => ({ name: '', type: 'label' }),
        Inspector: asInspector(LabelInspector),
    },
    macro_header: {
        createDefault: () => ({ body: [], name: 'new_macro', type: 'macro_header' }),
        getBranches: (node) => [{ label: 'BODY', nodes: readArray<PluginNode>(node, 'body'), path: ['body'] }],
        getSummary: (node) => readString(node, 'name', '(unnamed macro)'),
        icon: (size) => <Workflow color={t.accent.orange} size={size} />,
        Inspector: asInspector(MacroHeaderInspector),
        label: 'Macro',
        quickColor: { bg: t.bg.panelAlt, border: t.accent.orange },
    },
    while: {
        createDefault: () => ({ body: [], key: '', maxIterations: 10_000, op: 'eq', source: 'variable', type: 'while', value: true }),
        getBranches: (node) => [{ label: 'BODY', nodes: readArray<PluginNode>(node, 'body'), path: ['body'] }],
        getSummary: (node) => readString(node, 'key', 'loop'),
        icon: (size) => <Repeat color="#22c55e" size={size} />,
        Inspector: asInspector(WhileInspector),
        quickColor: { bg: t.bg.panelAlt, border: t.accent.green },
    },
};

