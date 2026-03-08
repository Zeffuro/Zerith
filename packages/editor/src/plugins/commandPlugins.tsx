import type { ComponentType, ReactNode } from 'react';

import { BuiltInCommandTypes } from 'core';
import { CommandSchemaRegistry } from 'core/schemas';
import {
    ArrowRightCircle, FileAudio, Gamepad2, GitFork, Image as ImageIcon, MessageSquare,
    Music, Repeat, Sigma, User, Workflow
} from 'lucide-react';

import type {
    BranchSpec,
    CommandPlugin,
    EditorCommandType,
    EditorNodeByType,
    NonMacroEditorCommandType,
    PluginAPI,
    PluginNode,
} from './types';

import { BackgroundInspector } from '../components/inspector/BackgroundInspector';
import { BgmInspector } from '../components/inspector/BgmInspector';
import { ChoiceInspector } from '../components/inspector/ChoiceInspector';
import { DialogueInspector } from '../components/inspector/DialogueInspector';
import { FlashInspector } from '../components/inspector/FlashInspector';
import { ForInspector } from '../components/inspector/ForInspector';
import { GotoInspector } from '../components/inspector/GotoInspector';
import { IfInspector } from '../components/inspector/IfInspector';
import { ItemInspector } from '../components/inspector/ItemInspector';
import { JumpInspector } from '../components/inspector/JumpInspector';
import { LabelInspector } from '../components/inspector/LabelInspector';
import { MacroHeaderInspector } from '../components/inspector/MacroHeaderInspector';
import { MacroInspector } from '../components/inspector/MacroInspector';
import { SetInspector } from '../components/inspector/SetInspector';
import { SfxInspector } from '../components/inspector/SfxInspector';
import { ShakeInspector } from '../components/inspector/ShakeInspector';
import { SpriteInspector } from '../components/inspector/SpriteInspector';
import { TransitionInspector } from '../components/inspector/TransitionInspector';
import { WaitInspector } from '../components/inspector/WaitInspector';
import { WhileInspector } from '../components/inspector/WhileInspector';

const FALLBACK_ICON = (size: number) => <Gamepad2 color="#94a3b8" size={size} />;
const titleCase = (s: string) => s.replaceAll('_', ' ').replaceAll(/\b\w/g, (c) => c.toUpperCase());

const asRecord = (value: unknown): null | Record<string, unknown> =>
    value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

type UnknownCommandPlugin = {
    createDefault?: () => PluginNode;
    getBranches?: (node: PluginNode) => BranchSpec[];
    getSummary?: (node: PluginNode) => string;
    icon: (size: number) => ReactNode;
    Inspector?: ComponentType<{ index?: null | number; node: PluginNode; }>;
    label: string;
    quickColor?: { bg: string; border: string };
    type: string;
};

function readArray<T = unknown>(node: unknown, key: string): T[] {
    const value = asRecord(node)?.[key];
    return Array.isArray(value) ? (value as T[]) : [];
}

function readNumber(node: unknown, key: string, fallback: number): number {
    const value = asRecord(node)?.[key];
    return typeof value === 'number' ? value : fallback;
}

function readString(node: unknown, key: string, fallback = ''): string {
    const value = asRecord(node)?.[key];
    return typeof value === 'string' ? value : fallback;
}

const PLUGIN_OVERRIDES: Partial<Record<EditorCommandType, Partial<CommandPlugin>>> = {
    background: {
        createDefault: () => ({ assetUrl: '', type: 'background' }),
        getSummary: (n) => readString(n, 'assetUrl', '(no asset)'),
        icon: (s) => <ImageIcon color="#34d399" size={s} />,
        Inspector: BackgroundInspector,
    },
    bgm: {
        createDefault: () => ({ action: 'play', assetUrl: '', type: 'bgm', volume: 0.5 }),
        getSummary: (n) => {
            const action = readString(n, 'action');
            if (action !== 'play') return action;
            const assetUrl = readString(n, 'assetUrl');
            const loop = asRecord(n)?.loop;
            const loopSuffix = typeof loop === 'boolean' ? ` • loop:${loop}` : '';
            return `play ${assetUrl}${loopSuffix}`;
        },
        icon: (s) => <Music color="#f472b6" size={s} />,
        Inspector: BgmInspector,
    },
    call: {
        createDefault: () => ({ name: '', type: 'call' }),
        getSummary: (n) => readString(n, 'name'),
        icon: (s) => <Workflow color="#f472b6" size={s} />,
        Inspector: MacroInspector,
    },
    choice: {
        createDefault: () => ({ options: [{ commands: [], label: 'Option 1' }], type: 'choice' }),
        getBranches: (n) => {
            const options = readArray<unknown>(n, 'options');
            return options.map((opt, index) => {
                const option = asRecord(opt);
                const labelValue = typeof option?.label === 'string' ? option.label : '';
                const commands = Array.isArray(option?.commands) ? (option.commands as PluginNode[]) : [];
                return {
                    label: `OPTION ${index + 1}${labelValue ? `: ${labelValue}` : ''}`,
                    nodes: commands,
                    path: ['options', index, 'commands'],
                };
            });
        },
        getSummary: (n) => `${readArray(n, 'options').length} options`,
        icon: (s) => <GitFork color="#fbbf24" size={s} />,
        Inspector: ChoiceInspector,
        quickColor: { bg: '#4a3b10', border: '#7a5f19' },
    },
    dialogue: {
        createDefault: () => ({ speaker: '???', text: '...', type: 'dialogue' }),
        getSummary: (n) => `${readString(n, 'speaker', '???')}: ${readString(n, 'text')}`,
        icon: (s) => <MessageSquare color="#60a5fa" size={s} />,
        Inspector: DialogueInspector,
    },
    flash: {
        createDefault: () => ({ color: 0xFF_FF_FF, duration: 200, type: 'flash', wait: false }),
        getSummary: (n) => {
            const color = readNumber(n, 'color', 0xFF_FF_FF);
            const hex = `#${color.toString(16).padStart(6, '0').toUpperCase()}`;
            return `${hex} • ${readNumber(n, 'duration', 200)}ms`;
        },
        Inspector: FlashInspector,
    },
    for: {
        createDefault: () => ({ body: [], from: 0, iterator: 'i', step: 1, to: 3, type: 'for' }),
        getBranches: (n) => [{ label: 'BODY', nodes: readArray<PluginNode>(n, 'body'), path: ['body'] }],
        getSummary: (n) => {
            const iterator = readString(n, 'iterator', 'i');
            const from = readNumber(n, 'from', 0);
            const to = readNumber(n, 'to', 0);
            const step = readNumber(n, 'step', 1);
            return `${iterator}: ${from}→${to} step ${step}`;
        },
        icon: (s) => <Sigma color="#60a5fa" size={s} />,
        Inspector: ForInspector,
        quickColor: { bg: '#11263d', border: '#1f4b7a' },
    },
    goto: {
        createDefault: () => ({ label: '', type: 'goto' }),
        Inspector: GotoInspector,
    },
    if: {
        createDefault: () => ({ else: [], key: '', op: 'eq', source: 'variable', then: [], type: 'if', value: true }),
        getBranches: (n) => [
            { label: 'THEN', nodes: readArray<PluginNode>(n, 'then'), path: ['then'] },
            { label: 'ELSE', nodes: readArray<PluginNode>(n, 'else'), path: ['else'] },
        ],
        getSummary: (n) => readString(n, 'key'),
        icon: (s) => <GitFork color="#4ec9b0" size={s} />,
        Inspector: IfInspector,
        quickColor: { bg: '#103a38', border: '#1f6a66' },
    },
    item: {
        createDefault: () => ({ action: 'add', id: '', type: 'item' }),
        getSummary: (n) => `${readString(n, 'action', 'add')} ${readString(n, 'id')}`,
        icon: (s) => <Gamepad2 color="#f87171" size={s} />,
        Inspector: ItemInspector,
    },
    jump: {
        createDefault: () => ({ to: '', type: 'jump' }),
        getSummary: (n) => readString(n, 'to'),
        icon: (s) => <ArrowRightCircle color="#fbbf24" size={s} />,
        Inspector: JumpInspector,
    },
    label: {
        createDefault: () => ({ name: '', type: 'label' }),
        Inspector: LabelInspector,
    },
    macro_header: {
        createDefault: () => ({ body: [], name: 'new_macro', type: 'macro_header' }),
        getBranches: (n) => [{ label: 'BODY', nodes: readArray<PluginNode>(n, 'body'), path: ['body'] }],
        getSummary: (n) => readString(n, 'name', '(unnamed macro)'),
        icon: (s) => <Workflow color="#f59e0b" size={s} />,
        Inspector: MacroHeaderInspector,
        label: 'Macro',
    },
    scene_change: {
        createDefault: () => ({ assetUrl: '', duration: 500, type: 'scene_change' }),
    },
    set: { Inspector: SetInspector },
    sfx: {
        createDefault: () => ({ assetUrl: '', type: 'sfx', volume: 0.8 }),
        getSummary: (n) => readString(n, 'assetUrl'),
        icon: (s) => <FileAudio color="#f472b6" size={s} />,
        Inspector: SfxInspector,
    },
    shake: {
        createDefault: () => ({ duration: 500, intensity: 10, type: 'shake', wait: false }),
        getSummary: (n) => `${readNumber(n, 'intensity', 10)} intensity • ${readNumber(n, 'duration', 500)}ms`,
        Inspector: ShakeInspector,
    },
    sprite: {
        createDefault: () => ({ action: 'show', id: '', type: 'sprite' }),
        getSummary: (n) => {
            const id = readString(n, 'id', 'sprite');
            const action = readString(n, 'action', 'show');
            const pose = readString(n, 'pose');
            return `${id} • ${action}${pose ? ` • ${pose}` : ''}`;
        },
        icon: (s) => <User color="#a78bfa" size={s} />,
        Inspector: SpriteInspector,
    },
    transition: {
        createDefault: () => ({ action: 'fade_out', duration: 300, type: 'transition' }),
        Inspector: TransitionInspector,
    },
    wait: {
        createDefault: () => ({ duration: 500, type: 'wait' }),
        Inspector: WaitInspector,
    },
    while: {
        createDefault: () => ({ body: [], key: '', maxIterations: 10_000, op: 'eq', source: 'variable', type: 'while', value: true }),
        getBranches: (n) => [{ label: 'BODY', nodes: readArray<PluginNode>(n, 'body'), path: ['body'] }],
        getSummary: (n) => readString(n, 'key', 'loop'),
        icon: (s) => <Repeat color="#22c55e" size={s} />,
        Inspector: WhileInspector,
        quickColor: { bg: '#11301b', border: '#1d5b32' },
    },
};

const editorCommandTypeSet = new Set<EditorCommandType>([...BuiltInCommandTypes, 'macro_header']);

function isEditorCommandType(type: string): type is EditorCommandType {
    return editorCommandTypeSet.has(type as EditorCommandType);
}

export const COMMAND_TYPES: EditorCommandType[] = [...new Set([
    ...Object.keys(CommandSchemaRegistry),
    'macro_header',
])].filter(isEditorCommandType);

export const COMMAND_PLUGINS: Record<EditorCommandType, CommandPlugin> = Object.fromEntries(
    COMMAND_TYPES.map((type) => {
        const o = PLUGIN_OVERRIDES[type] ?? {};
        return [
            type,
            {
                createDefault: o.createDefault ?? (() => ({ type } as EditorNodeByType<EditorCommandType>)),
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
        return this.getPlugin(type).createDefault?.() ?? ({ type } as EditorNodeByType<TType>);
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
