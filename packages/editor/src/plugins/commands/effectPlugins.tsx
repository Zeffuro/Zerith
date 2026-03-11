import { FlashInspector } from '../../components/inspector/FlashInspector';
import { SetInspector } from '../../components/inspector/SetInspector';
import { ShakeInspector } from '../../components/inspector/ShakeInspector';
import { TransitionInspector } from '../../components/inspector/TransitionInspector';
import { WaitInspector } from '../../components/inspector/WaitInspector';
import { asInspector, type CommandPluginOverrides, readNumber } from './shared';

export const effectPluginOverrides: CommandPluginOverrides = {
    flash: {
        createDefault: () => ({ color: 0xFF_FF_FF, duration: 200, type: 'flash', wait: false }),
        getSummary: (node) => {
            const color = readNumber(node, 'color', 0xFF_FF_FF);
            const hex = `#${color.toString(16).padStart(6, '0').toUpperCase()}`;
            return `${hex} • ${readNumber(node, 'duration', 200)}ms`;
        },
        Inspector: asInspector(FlashInspector),
    },
    scene_change: {
        createDefault: () => ({ assetUrl: '', duration: 500, type: 'scene_change' }),
    },
    set: { Inspector: asInspector(SetInspector) },
    shake: {
        createDefault: () => ({ duration: 500, intensity: 10, type: 'shake', wait: false }),
        getSummary: (node) => `${readNumber(node, 'intensity', 10)} intensity • ${readNumber(node, 'duration', 500)}ms`,
        Inspector: asInspector(ShakeInspector),
    },
    transition: {
        createDefault: () => ({ action: 'fade_out', duration: 300, type: 'transition' }),
        Inspector: asInspector(TransitionInspector),
    },
    wait: {
        createDefault: () => ({ duration: 500, type: 'wait' }),
        Inspector: asInspector(WaitInspector),
    },
};

