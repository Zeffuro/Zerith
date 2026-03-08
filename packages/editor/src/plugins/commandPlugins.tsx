import { BuiltInCommandTypes } from 'core';
import { CommandSchemaRegistry } from 'core/schemas';
import type { ComponentType, ReactNode } from 'react';
import {
    MessageSquare, Image as ImageIcon, Music, FileAudio, User, Workflow,
    GitFork, ArrowRightCircle, Gamepad2, Repeat, Sigma
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
import { DialogueInspector } from '../components/inspector/DialogueInspector';
import { SpriteInspector } from '../components/inspector/SpriteInspector';
import { MacroInspector } from '../components/inspector/MacroInspector';
import { IfInspector } from '../components/inspector/IfInspector';
import { WhileInspector } from '../components/inspector/WhileInspector';
import { ForInspector } from '../components/inspector/ForInspector';
import { ChoiceInspector } from '../components/inspector/ChoiceInspector';
import { JumpInspector } from '../components/inspector/JumpInspector';
import { SetInspector } from '../components/inspector/SetInspector';
import { SfxInspector } from '../components/inspector/SfxInspector';
import { LabelInspector } from '../components/inspector/LabelInspector';
import { GotoInspector } from '../components/inspector/GotoInspector';
import { WaitInspector } from '../components/inspector/WaitInspector';
import { TransitionInspector } from '../components/inspector/TransitionInspector';
import { ShakeInspector } from '../components/inspector/ShakeInspector';
import { FlashInspector } from '../components/inspector/FlashInspector';
import { ItemInspector } from '../components/inspector/ItemInspector';
import { MacroHeaderInspector } from '../components/inspector/MacroHeaderInspector';

const FALLBACK_ICON = (size: number) => <Gamepad2 size={size} color="#94a3b8" />;
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

function readString(node: unknown, key: string, fallback = ''): string {
    const value = asRecord(node)?.[key];
    return typeof value === 'string' ? value : fallback;
}

function readNumber(node: unknown, key: string, fallback: number): number {
    const value = asRecord(node)?.[key];
    return typeof value === 'number' ? value : fallback;
}

function readArray<T = unknown>(node: unknown, key: string): T[] {
    const value = asRecord(node)?.[key];
    return Array.isArray(value) ? (value as T[]) : [];
}

type UnknownCommandPlugin = {
    type: string;
    label: string;
    icon: (size: number) => ReactNode;
    quickColor?: { bg: string; border: string };
    createDefault?: () => PluginNode;
    getSummary?: (node: PluginNode) => string;
    getBranches?: (node: PluginNode) => BranchSpec[];
    Inspector?: ComponentType<{ node: PluginNode; index?: number | null }>;
};

const PLUGIN_OVERRIDES: Partial<Record<EditorCommandType, Partial<CommandPlugin>>> = {
    dialogue: {
        icon: (s) => <MessageSquare size={s} color="#60a5fa" />,
        createDefault: () => ({ type: 'dialogue', speaker: '???', text: '...' }),
        getSummary: (n) => `${readString(n, 'speaker', '???')}: ${readString(n, 'text')}`,
        Inspector: DialogueInspector,
    },
    background: {
        icon: (s) => <ImageIcon size={s} color="#34d399" />,
        createDefault: () => ({ type: 'background', assetUrl: '' }),
        getSummary: (n) => readString(n, 'assetUrl', '(no asset)'),
        Inspector: BackgroundInspector,
    },
    sprite: {
        icon: (s) => <User size={s} color="#a78bfa" />,
        createDefault: () => ({ type: 'sprite', id: '', action: 'show' }),
        getSummary: (n) => {
            const id = readString(n, 'id', 'sprite');
            const action = readString(n, 'action', 'show');
            const pose = readString(n, 'pose');
            return `${id} • ${action}${pose ? ` • ${pose}` : ''}`;
        },
        Inspector: SpriteInspector,
    },
    call: {
        icon: (s) => <Workflow size={s} color="#f472b6" />,
        createDefault: () => ({ type: 'call', name: '' }),
        getSummary: (n) => readString(n, 'name'),
        Inspector: MacroInspector,
    },
    bgm: {
        icon: (s) => <Music size={s} color="#f472b6" />,
        createDefault: () => ({ type: 'bgm', action: 'play', assetUrl: '', volume: 0.5 }),
        getSummary: (n) => {
            const action = readString(n, 'action');
            if (action !== 'play') return action;
            const assetUrl = readString(n, 'assetUrl');
            const loop = asRecord(n)?.loop;
            const loopSuffix = typeof loop === 'boolean' ? ` • loop:${loop}` : '';
            return `play ${assetUrl}${loopSuffix}`;
        },
        Inspector: BgmInspector,
    },
    sfx: {
        icon: (s) => <FileAudio size={s} color="#f472b6" />,
        createDefault: () => ({ type: 'sfx', assetUrl: '', volume: 0.8 }),
        getSummary: (n) => readString(n, 'assetUrl'),
        Inspector: SfxInspector,
    },
    choice: {
        icon: (s) => <GitFork size={s} color="#fbbf24" />,
        quickColor: { bg: '#4a3b10', border: '#7a5f19' },
        createDefault: () => ({ type: 'choice', options: [{ label: 'Option 1', commands: [] }] }),
        getSummary: (n) => `${readArray(n, 'options').length} options`,
        getBranches: (n) => {
            const options = readArray<unknown>(n, 'options');
            return options.map((opt, i) => {
                const option = asRecord(opt);
                const labelValue = typeof option?.label === 'string' ? option.label : '';
                const commands = Array.isArray(option?.commands) ? (option.commands as PluginNode[]) : [];
                return {
                    label: `OPTION ${i + 1}${labelValue ? `: ${labelValue}` : ''}`,
                    path: ['options', i, 'commands'],
                    nodes: commands,
                };
            });
        },
        Inspector: ChoiceInspector,
    },
    if: {
        icon: (s) => <GitFork size={s} color="#4ec9b0" />,
        quickColor: { bg: '#103a38', border: '#1f6a66' },
        createDefault: () => ({ type: 'if', source: 'variable', key: '', op: 'eq', value: true, then: [], else: [] }),
        getSummary: (n) => readString(n, 'key'),
        getBranches: (n) => [
            { label: 'THEN', path: ['then'], nodes: readArray<PluginNode>(n, 'then') },
            { label: 'ELSE', path: ['else'], nodes: readArray<PluginNode>(n, 'else') },
        ],
        Inspector: IfInspector,
    },
    while: {
        icon: (s) => <Repeat size={s} color="#22c55e" />,
        quickColor: { bg: '#11301b', border: '#1d5b32' },
        createDefault: () => ({ type: 'while', source: 'variable', key: '', op: 'eq', value: true, body: [], maxIterations: 10000 }),
        getSummary: (n) => readString(n, 'key', 'loop'),
        getBranches: (n) => [{ label: 'BODY', path: ['body'], nodes: readArray<PluginNode>(n, 'body') }],
        Inspector: WhileInspector,
    },
    for: {
        icon: (s) => <Sigma size={s} color="#60a5fa" />,
        quickColor: { bg: '#11263d', border: '#1f4b7a' },
        createDefault: () => ({ type: 'for', iterator: 'i', from: 0, to: 3, step: 1, body: [] }),
        getSummary: (n) => {
            const iterator = readString(n, 'iterator', 'i');
            const from = readNumber(n, 'from', 0);
            const to = readNumber(n, 'to', 0);
            const step = readNumber(n, 'step', 1);
            return `${iterator}: ${from}→${to} step ${step}`;
        },
        getBranches: (n) => [{ label: 'BODY', path: ['body'], nodes: readArray<PluginNode>(n, 'body') }],
        Inspector: ForInspector,
    },
    jump: {
        icon: (s) => <ArrowRightCircle size={s} color="#fbbf24" />,
        createDefault: () => ({ type: 'jump', to: '' }),
        getSummary: (n) => readString(n, 'to'),
        Inspector: JumpInspector,
    },
    set: { Inspector: SetInspector },
    scene_change: {
        createDefault: () => ({ type: 'scene_change', assetUrl: '', duration: 500 }),
    },
    label: {
        createDefault: () => ({ type: 'label', name: '' }),
        Inspector: LabelInspector,
    },
    goto: {
        createDefault: () => ({ type: 'goto', label: '' }),
        Inspector: GotoInspector,
    },
    wait: {
        createDefault: () => ({ type: 'wait', duration: 500 }),
        Inspector: WaitInspector,
    },
    transition: {
        createDefault: () => ({ type: 'transition', action: 'fade_out', duration: 300 }),
        Inspector: TransitionInspector,
    },
    shake: {
        createDefault: () => ({ type: 'shake', intensity: 10, duration: 500, wait: false }),
        Inspector: ShakeInspector,
        getSummary: (n) => `${readNumber(n, 'intensity', 10)} intensity • ${readNumber(n, 'duration', 500)}ms`,
    },
    flash: {
        createDefault: () => ({ type: 'flash', color: 0xffffff, duration: 200, wait: false }),
        Inspector: FlashInspector,
        getSummary: (n) => {
            const color = readNumber(n, 'color', 0xffffff);
            const hex = `#${color.toString(16).padStart(6, '0').toUpperCase()}`;
            return `${hex} • ${readNumber(n, 'duration', 200)}ms`;
        },
    },
    item: {
        icon: (s) => <Gamepad2 size={s} color="#f87171" />,
        createDefault: () => ({ type: 'item', action: 'add', id: '' }),
        getSummary: (n) => `${readString(n, 'action', 'add')} ${readString(n, 'id')}`,
        Inspector: ItemInspector,
    },
    macro_header: {
        label: 'Macro',
        icon: (s) => <Workflow size={s} color="#f59e0b" />,
        createDefault: () => ({ type: 'macro_header', name: 'new_macro', body: [] }),
        getSummary: (n) => readString(n, 'name', '(unnamed macro)'),
        getBranches: (n) => [{ label: 'BODY', path: ['body'], nodes: readArray<PluginNode>(n, 'body') }],
        Inspector: MacroHeaderInspector,
    },
};

const editorCommandTypeSet = new Set<EditorCommandType>([...BuiltInCommandTypes, 'macro_header']);

function isEditorCommandType(type: string): type is EditorCommandType {
    return editorCommandTypeSet.has(type as EditorCommandType);
}

export const COMMAND_TYPES: EditorCommandType[] = Array.from(new Set([
    ...Object.keys(CommandSchemaRegistry),
    'macro_header',
])).filter(isEditorCommandType);

export const COMMAND_PLUGINS: Record<EditorCommandType, CommandPlugin> = Object.fromEntries(
    COMMAND_TYPES.map((type) => {
        const o = PLUGIN_OVERRIDES[type] ?? {};
        return [
            type,
            {
                type,
                label: o.label ?? titleCase(type),
                icon: o.icon ?? FALLBACK_ICON,
                quickColor: o.quickColor,
                createDefault: o.createDefault ?? (() => ({ type } as EditorNodeByType<EditorCommandType>)),
                getSummary: o.getSummary,
                getBranches: o.getBranches,
                Inspector: o.Inspector,
            },
        ];
    })
) as Record<EditorCommandType, CommandPlugin>;

const typedCommandTypes = [...COMMAND_TYPES];

export const pluginApi: PluginAPI = {
    getPlugin<TType extends EditorCommandType>(type: TType) {
        return COMMAND_PLUGINS[type] as unknown as CommandPlugin<TType>;
    },
    getAllPlugins() {
        return typedCommandTypes
            .filter((type): type is NonMacroEditorCommandType => type !== 'macro_header')
            .map((type) => COMMAND_PLUGINS[type] as CommandPlugin<NonMacroEditorCommandType>);
    },
    createDefaultCommand<TType extends EditorCommandType>(type: TType) {
        return this.getPlugin(type).createDefault?.() ?? ({ type } as EditorNodeByType<TType>);
    },
    getCommandTypes() {
        return [...typedCommandTypes];
    },
};

export function getPlugin<TType extends EditorCommandType>(type: TType): CommandPlugin<TType>;
export function getPlugin(type: string): CommandPlugin | UnknownCommandPlugin;
export function getPlugin(type: string): CommandPlugin | UnknownCommandPlugin {
    if (isEditorCommandType(type)) {
        return pluginApi.getPlugin(type);
    }
    return {
        type,
        label: titleCase(type),
        icon: FALLBACK_ICON,
        createDefault: () => ({ type }),
    };
}

export function getAllPlugins(): CommandPlugin<NonMacroEditorCommandType>[] {
    return pluginApi.getAllPlugins();
}

export function createDefaultCommand<TType extends EditorCommandType>(type: TType): EditorNodeByType<TType>;
export function createDefaultCommand(type: string): PluginNode;
export function createDefaultCommand(type: string): PluginNode {
    const plugin = getPlugin(type);
    return plugin.createDefault?.() ?? { type };
}
