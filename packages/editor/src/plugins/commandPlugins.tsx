import type { ReactNode } from 'react';
import type React from 'react';
import { CommandSchemaRegistry } from 'core/schemas';
import {
    MessageSquare, Image as ImageIcon, Music, FileAudio, User, Workflow,
    GitFork, ArrowRightCircle, Gamepad2, Repeat, Sigma
} from 'lucide-react';
import type { ScriptPath } from '../utils/scriptPathUtils';

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

export type BranchSpec = { label: string; path: ScriptPath; nodes: any[] };

export type CommandPlugin = {
    type: string;
    label: string;
    icon: (size: number) => ReactNode;
    quickColor?: { bg: string; border: string };
    createDefault?: () => any;
    getSummary?: (node: any) => string;
    getBranches?: (node: any) => BranchSpec[];
    Inspector?: React.ComponentType<{ node: any; index?: number | null }>;
};

const FALLBACK_ICON = (size: number) => <Gamepad2 size={size} color="#94a3b8" />;
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const PLUGIN_OVERRIDES: Record<string, Partial<CommandPlugin>> = {
    dialogue: {
        icon: (s) => <MessageSquare size={s} color="#60a5fa" />,
        createDefault: () => ({ type: 'dialogue', speaker: '???', text: '...' }),
        getSummary: (n) => `${n.speaker ?? '???'}: ${n.text ?? ''}`,
        Inspector: DialogueInspector,
    },
    background: {
        icon: (s) => <ImageIcon size={s} color="#34d399" />,
        createDefault: () => ({ type: 'background', assetUrl: '' }),
        getSummary: (n) => n.assetUrl || '(no asset)',
        Inspector: BackgroundInspector,
    },
    sprite: {
        icon: (s) => <User size={s} color="#a78bfa" />,
        createDefault: () => ({ type: 'sprite', id: '', action: 'show' }),
        getSummary: (n) => `${n.id ?? 'sprite'} • ${n.action ?? 'show'}${n.pose ? ` • ${n.pose}` : ''}`,
        Inspector: SpriteInspector,
    },
    call: {
        icon: (s) => <Workflow size={s} color="#f472b6" />,
        createDefault: () => ({ type: 'call', name: '' }),
        getSummary: (n) => n.name || '',
        Inspector: MacroInspector,
    },
    bgm: {
        icon: (s) => <Music size={s} color="#f472b6" />,
        createDefault: () => ({ type: 'bgm', action: 'play', assetUrl: '', volume: 0.5 }),
        getSummary: (n) =>
            n.action === 'play'
                ? `play ${n.assetUrl ?? ''}${n.loop !== undefined ? ` • loop:${n.loop}` : ''}`
                : n.action,
        Inspector: BgmInspector
    },
    sfx: {
        icon: (s) => <FileAudio size={s} color="#f472b6" />,
        createDefault: () => ({ type: 'sfx', assetUrl: '', volume: 0.8 }),
        getSummary: (n) => n.assetUrl || '',
        Inspector: SfxInspector,
    },
    choice: {
        icon: (s) => <GitFork size={s} color="#fbbf24" />,
        quickColor: { bg: '#4a3b10', border: '#7a5f19' },
        createDefault: () => ({ type: 'choice', options: [{ label: 'Option 1', commands: [] }] }),
        getSummary: (n) => `${Array.isArray(n.options) ? n.options.length : 0} options`,
        getBranches: (n) =>
            Array.isArray(n.options)
                ? n.options.map((opt: any, i: number) => ({
                    label: `OPTION ${i + 1}${opt?.label ? `: ${opt.label}` : ''}`,
                    path: ['options', i, 'commands'],
                    nodes: Array.isArray(opt?.commands) ? opt.commands : [],
                }))
                : [],
        Inspector: ChoiceInspector,
    },
    if: {
        icon: (s) => <GitFork size={s} color="#4ec9b0" />,
        quickColor: { bg: '#103a38', border: '#1f6a66' },
        createDefault: () => ({ type: 'if', source: 'variable', key: '', op: 'eq', value: true, then: [], else: [] }),
        getSummary: (n) => n.key || '',
        getBranches: (n) => [
            { label: 'THEN', path: ['then'], nodes: Array.isArray(n.then) ? n.then : [] },
            { label: 'ELSE', path: ['else'], nodes: Array.isArray(n.else) ? n.else : [] },
        ],
        Inspector: IfInspector,
    },
    while: {
        icon: (s) => <Repeat size={s} color="#22c55e" />,
        quickColor: { bg: '#11301b', border: '#1d5b32' },
        createDefault: () => ({ type: 'while', source: 'variable', key: '', op: 'eq', value: true, body: [], maxIterations: 10000 }),
        getSummary: (n) => n.key || 'loop',
        getBranches: (n) => [{ label: 'BODY', path: ['body'], nodes: Array.isArray(n.body) ? n.body : [] }],
        Inspector: WhileInspector,
    },
    for: {
        icon: (s) => <Sigma size={s} color="#60a5fa" />,
        quickColor: { bg: '#11263d', border: '#1f4b7a' },
        createDefault: () => ({ type: 'for', iterator: 'i', from: 0, to: 3, step: 1, body: [] }),
        getSummary: (n) => `${n.iterator ?? 'i'}: ${n.from ?? 0}→${n.to ?? 0} step ${n.step ?? 1}`,
        getBranches: (n) => [{ label: 'BODY', path: ['body'], nodes: Array.isArray(n.body) ? n.body : [] }],
        Inspector: ForInspector,
    },
    jump: {
        icon: (s) => <ArrowRightCircle size={s} color="#fbbf24" />,
        createDefault: () => ({ type: 'jump', to: '' }),
        getSummary: (n) => n.to || '',
        Inspector: JumpInspector,
    },
    set: { Inspector: SetInspector },
    label: { Inspector: LabelInspector },
    goto: { Inspector: GotoInspector },
    wait: { Inspector: WaitInspector },
    transition: { Inspector: TransitionInspector },
    shake: {
        Inspector: ShakeInspector,
        getSummary: (n) => `${n.intensity ?? 10} intensity • ${n.duration ?? 500}ms`
    },
    flash: {
        Inspector: FlashInspector,
        getSummary: (n) => {
            const hex = '#' + (n.color ?? 16777215).toString(16).padStart(6, '0').toUpperCase();
            return `${hex} • ${n.duration ?? 200}ms`;
        }
    },
    item: {
        icon: (s) => <Gamepad2 size={s} color="#f87171" />,
        createDefault: () => ({ type: 'item', action: 'add', id: '' }),
        getSummary: (n) => `${n.action ?? 'add'} ${n.id ?? ''}`,
        Inspector: ItemInspector,
    },
    macro_header: {
        label: 'Macro',
        icon: (s) => <Workflow size={s} color="#f59e0b" />,
        getSummary: (n) => n.name ?? '(unnamed macro)',
        getBranches: (n) => [{ label: 'BODY', path: ['body'], nodes: Array.isArray(n.body) ? n.body : [] }],
        Inspector: MacroHeaderInspector,
    },
};

export const COMMAND_TYPES = Array.from(new Set([
    ...Object.keys(CommandSchemaRegistry),
    'macro_header',
]));

export const COMMAND_PLUGINS: Record<string, CommandPlugin> = Object.fromEntries(
    COMMAND_TYPES.map((type) => {
        const o = PLUGIN_OVERRIDES[type] ?? {};
        return [type, {
            type,
            label: o.label ?? titleCase(type),
            icon: o.icon ?? FALLBACK_ICON,
            quickColor: o.quickColor,
            createDefault: o.createDefault ?? (() => ({ type })),
            getSummary: o.getSummary,
            getBranches: o.getBranches,
            Inspector: o.Inspector,
        }];
    })
);

export function getPlugin(type: string): CommandPlugin {
    return COMMAND_PLUGINS[type] ?? {
        type,
        label: titleCase(type),
        icon: FALLBACK_ICON,
        createDefault: () => ({ type }),
    };
}

export function getAllPlugins(): CommandPlugin[] {
    return Object.values(COMMAND_PLUGINS).filter((p) => p.type !== 'macro_header');
}

export function createDefaultCommand(type: string) {
    return getPlugin(type).createDefault?.() ?? { type };
}
