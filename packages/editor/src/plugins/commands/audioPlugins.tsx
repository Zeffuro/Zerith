import { FileAudio, Music } from 'lucide-react';

import { BgmInspector } from '../../components/inspector/BgmInspector';
import { SfxInspector } from '../../components/inspector/SfxInspector';
import { editorTheme as t } from '../../theme/editorTheme';
import { asInspector, asRecord, type CommandPluginOverrides, readString } from './shared';

export const audioPluginOverrides: CommandPluginOverrides = {
    bgm: {
        createDefault: () => ({ action: 'play', assetUrl: '', type: 'bgm', volume: 0.5 }),
        getSummary: (node) => {
            const action = readString(node, 'action');
            if (action !== 'play') return action;
            const assetUrl = readString(node, 'assetUrl');
            const loop = asRecord(node)?.loop;
            const loopSuffix = typeof loop === 'boolean' ? ` • loop:${loop}` : '';
            return `play ${assetUrl}${loopSuffix}`;
        },
        icon: (size) => <Music color={t.accent.purple} size={size} />,
        Inspector: asInspector(BgmInspector),
        quickColor: { bg: t.bg.panelAlt, border: t.accent.purple },
    },
    sfx: {
        createDefault: () => ({ assetUrl: '', type: 'sfx', volume: 0.8 }),
        getSummary: (node) => readString(node, 'assetUrl'),
        icon: (size) => <FileAudio color={t.accent.purple} size={size} />,
        Inspector: asInspector(SfxInspector),
        quickColor: { bg: t.bg.panelAlt, border: t.accent.purple },
    },
};

