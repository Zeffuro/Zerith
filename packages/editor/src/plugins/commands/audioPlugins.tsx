import { FileAudio, Music } from 'lucide-react';

import { BgmInspector } from '../../components/inspector/BgmInspector';
import { SfxInspector } from '../../components/inspector/SfxInspector';
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
        icon: (size) => <Music color="#f472b6" size={size} />,
        Inspector: asInspector(BgmInspector),
    },
    sfx: {
        createDefault: () => ({ assetUrl: '', type: 'sfx', volume: 0.8 }),
        getSummary: (node) => readString(node, 'assetUrl'),
        icon: (size) => <FileAudio color="#f472b6" size={size} />,
        Inspector: asInspector(SfxInspector),
    },
};

