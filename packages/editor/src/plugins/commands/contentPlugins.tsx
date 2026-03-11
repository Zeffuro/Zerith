import { Gamepad2, GitFork, Image as ImageIcon, MessageSquare, User } from 'lucide-react';

import type { PluginNode } from '../types';

import { BackgroundInspector } from '../../components/inspector/BackgroundInspector';
import { ChoiceInspector } from '../../components/inspector/ChoiceInspector';
import { DialogueInspector } from '../../components/inspector/DialogueInspector';
import { ItemInspector } from '../../components/inspector/ItemInspector';
import { SpriteInspector } from '../../components/inspector/SpriteInspector';
import { asInspector, asRecord, type CommandPluginOverrides, readArray, readString } from './shared';

export const contentPluginOverrides: CommandPluginOverrides = {
    background: {
        createDefault: () => ({ assetUrl: '', type: 'background' }),
        getSummary: (node) => readString(node, 'assetUrl', '(no asset)'),
        icon: (size) => <ImageIcon color="#34d399" size={size} />,
        Inspector: asInspector(BackgroundInspector),
    },
    choice: {
        createDefault: () => ({ options: [{ commands: [], label: 'Option 1' }], type: 'choice' }),
        getBranches: (node) => {
            const options = readArray<unknown>(node, 'options');
            return options.map((option_, index) => {
                const option = asRecord(option_);
                const labelValue = typeof option?.label === 'string' ? option.label : '';
                const commands = Array.isArray(option?.commands) ? (option.commands as PluginNode[]) : [];
                return {
                    label: `OPTION ${index + 1}${labelValue ? `: ${labelValue}` : ''}`,
                    nodes: commands,
                    path: ['options', index, 'commands'],
                };
            });
        },
        getSummary: (node) => `${readArray(node, 'options').length} options`,
        icon: (size) => <GitFork color="#fbbf24" size={size} />,
        Inspector: asInspector(ChoiceInspector),
        quickColor: { bg: '#4a3b10', border: '#7a5f19' },
    },
    dialogue: {
        createDefault: () => ({ speaker: '???', text: '...', type: 'dialogue' }),
        getSummary: (node) => `${readString(node, 'speaker', '???')}: ${readString(node, 'text')}`,
        icon: (size) => <MessageSquare color="#60a5fa" size={size} />,
        Inspector: asInspector(DialogueInspector),
    },
    item: {
        createDefault: () => ({ action: 'add', id: '', type: 'item' }),
        getSummary: (node) => `${readString(node, 'action', 'add')} ${readString(node, 'id')}`,
        icon: (size) => <Gamepad2 color="#f87171" size={size} />,
        Inspector: asInspector(ItemInspector),
    },
    sprite: {
        createDefault: () => ({ action: 'show', id: '', type: 'sprite' }),
        getSummary: (node) => {
            const id = readString(node, 'id', 'sprite');
            const action = readString(node, 'action', 'show');
            const pose = readString(node, 'pose');
            return `${id} • ${action}${pose ? ` • ${pose}` : ''}`;
        },
        icon: (size) => <User color="#a78bfa" size={size} />,
        Inspector: asInspector(SpriteInspector),
    },
};

