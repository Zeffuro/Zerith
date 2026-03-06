import type { ReactNode } from 'react';
import type React from 'react';
import { CommandSchemaRegistry } from 'core';
import {
    MessageSquare,
    Image as ImageIcon,
    Music,
    FileAudio,
    User,
    Workflow,
    GitFork,
    ArrowRightCircle,
    Gamepad2,
} from 'lucide-react';
import type { ScriptPath } from '../utils/scriptPathUtils';

// Inspectors
import { DialogueInspector } from '../components/inspector/DialogueInspector';
import { SpriteInspector } from '../components/inspector/SpriteInspector';
import { MacroInspector } from '../components/inspector/MacroInspector';
import { IfInspector } from '../components/inspector/IfInspector';
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

export type BranchSpec = { label: string; path: ScriptPath; nodes: any[] };

export type CommandPlugin = {
    type: string;
    label: string;
    icon: (size: number) => ReactNode;
    quick?: boolean;
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
        quick: true,
        createDefault: () => ({ type: 'dialogue', speaker: '???', text: '...' }),
        getSummary: (n) => n.text || '',
        Inspector: DialogueInspector,
    },
    background: {
        icon: (s) => <ImageIcon size={s} color="#34d399" />,
        quick: true,
        createDefault: () => ({ type: 'background', assetUrl: '' }),
        getSummary: (n) => n.assetUrl || '',
    },
    sprite: {
        icon: (s) => <User size={s} color="#a78bfa" />,
        quick: true,
        createDefault: () => ({ type: 'sprite', id: '', action: 'show' }),
        getSummary: (n) => n.id || n.assetUrl || '',
        Inspector: SpriteInspector,
    },
    call: {
        icon: (s) => <Workflow size={s} color="#f472b6" />,
        quick: true,
        createDefault: () => ({ type: 'call', name: '' }),
        getSummary: (n) => n.name || '',
        Inspector: MacroInspector,
    },
    bgm: {
        icon: (s) => <Music size={s} color="#f472b6" />,
        quick: true,
        createDefault: () => ({ type: 'bgm', action: 'play', assetUrl: '', volume: 0.5 }),
        getSummary: (n) => n.assetUrl || n.action || '',
    },
    sfx: {
        icon: (s) => <FileAudio size={s} color="#f472b6" />,
        createDefault: () => ({ type: 'sfx', assetUrl: '', volume: 0.8 }),
        getSummary: (n) => n.assetUrl || '',
        Inspector: SfxInspector,
    },
    choice: {
        icon: (s) => <GitFork size={s} color="#fbbf24" />,
        quick: true,
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
        quick: true,
        quickColor: { bg: '#103a38', border: '#1f6a66' },
        createDefault: () => ({ type: 'if', source: 'variable', key: '', op: 'eq', value: true, then: [], else: [] }),
        getSummary: (n) => n.key || '',
        getBranches: (n) => [
            { label: 'THEN', path: ['then'], nodes: Array.isArray(n.then) ? n.then : [] },
            { label: 'ELSE', path: ['else'], nodes: Array.isArray(n.else) ? n.else : [] },
        ],
        Inspector: IfInspector,
    },
    jump: {
        icon: (s) => <ArrowRightCircle size={s} color="#fbbf24" />,
        quick: true,
        createDefault: () => ({ type: 'jump', to: '' }),
        getSummary: (n) => n.to || '',
        Inspector: JumpInspector,
    },
    set: {
        Inspector: SetInspector,
    },
    label: {
        Inspector: LabelInspector,
    },
    goto: {
        Inspector: GotoInspector,
    },
    wait: {
        Inspector: WaitInspector,
    },
    transition: {
        Inspector: TransitionInspector,
    },
    shake: {
        Inspector: ShakeInspector,
    },
    flash: {
        Inspector: FlashInspector,
    },
    item: {
        Inspector: ItemInspector,
    },
};

export const COMMAND_TYPES = Object.keys(CommandSchemaRegistry);

export const COMMAND_PLUGINS: Record<string, CommandPlugin> = Object.fromEntries(
    COMMAND_TYPES.map((type) => {
        const o = PLUGIN_OVERRIDES[type] ?? {};
        const plugin: CommandPlugin = {
            type,
            label: o.label ?? titleCase(type),
            icon: o.icon ?? FALLBACK_ICON,
            quick: o.quick,
            quickColor: o.quickColor,
            createDefault: o.createDefault ?? (() => ({ type })),
            getSummary: o.getSummary,
            getBranches: o.getBranches,
            Inspector: o.Inspector,
        };
        return [type, plugin];
    })
);

export function getPlugin(type: string): CommandPlugin {
    return (
        COMMAND_PLUGINS[type] ?? {
            type,
            label: titleCase(type),
            icon: FALLBACK_ICON,
            createDefault: () => ({ type }),
        }
    );
}

export function createDefaultCommand(type: string) {
    return getPlugin(type).createDefault?.() ?? { type };
}