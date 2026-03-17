import { Gamepad2, GitFork, Image as ImageIcon, MessageSquare, User } from 'lucide-react';

import type { PluginNode } from '../types';

import { BackgroundInspector } from '../../components/inspector/BackgroundInspector';
import { ChoiceInspector } from '../../components/inspector/ChoiceInspector';
import { DialogueInspector } from '../../components/inspector/DialogueInspector';
import { ItemInspector } from '../../components/inspector/ItemInspector';
import { SpriteInspector } from '../../components/inspector/SpriteInspector';
import { editorTheme as t } from '../../theme/editorTheme';
import { asInspector, asRecord, type CommandPluginOverrides, readArray, readString } from './shared';

export const contentPluginOverrides: CommandPluginOverrides = {
    background: {
        createDefault: () => ({ assetUrl: '', type: 'background' }),
        getSummary: (node) => readString(node, 'assetUrl', '(no asset)'),
        icon: (size) => <ImageIcon color={t.accent.teal} size={size} />,
        Inspector: asInspector(BackgroundInspector),
        quickColor: { bg: t.bg.panelAlt, border: t.accent.teal },
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
        icon: (size) => <GitFork color={t.accent.yellow} size={size} />,
        Inspector: asInspector(ChoiceInspector),
        quickColor: { bg: t.bg.panelAlt, border: t.accent.yellow },
    },
    dialogue: {
        createDefault: () => ({ speaker: '???', text: '...', type: 'dialogue' }),
        getSummary: (node) => `${readString(node, 'speaker', '???')}: ${readString(node, 'text')}`,
        icon: (size) => <MessageSquare color={t.accent.blue} size={size} />,
        Inspector: asInspector(DialogueInspector),
        quickColor: { bg: t.bg.panelAlt, border: t.accent.blue },
    },
    item: {
        createDefault: () => ({ action: 'add', id: '', type: 'item' }),
        getSummary: (node) => `${readString(node, 'action', 'add')} ${readString(node, 'id')}`,
        icon: (size) => <Gamepad2 color={t.accent.red} size={size} />,
        Inspector: asInspector(ItemInspector),
        quickColor: { bg: t.bg.panelAlt, border: t.accent.red },
    },
    sprite: {
        createDefault: () => ({ action: 'show', id: '', type: 'sprite' }),
        getSummary: (node) => {
            const id = readString(node, 'id', 'sprite');
            const action = readString(node, 'action', 'show');
            const pose = readString(node, 'pose');
            return `${id} • ${action}${pose ? ` • ${pose}` : ''}`;
        },
        icon: (size) => <User color={t.accent.purple} size={size} />,
        Inspector: asInspector(SpriteInspector),
        quickColor: { bg: t.bg.panelAlt, border: t.accent.purple },
    },
};

