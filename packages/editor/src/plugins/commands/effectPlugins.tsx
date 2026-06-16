import { WEATHER_PRESET_DEFAULTS, type WeatherPreset } from 'core';
import { CloudRain } from 'lucide-react';

import { FlashInspector } from '../../components/inspector/FlashInspector';
import { SetInspector } from '../../components/inspector/SetInspector';
import { ShakeInspector } from '../../components/inspector/ShakeInspector';
import { TransitionInspector } from '../../components/inspector/TransitionInspector';
import { WaitInspector } from '../../components/inspector/WaitInspector';
import { WeatherInspector } from '../../components/inspector/WeatherInspector';
import { editorTheme as t } from '../../theme/editorTheme';
import { asInspector, type CommandPluginOverrides, readNumber, readString } from './shared';

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
    weather: {
        createDefault: () => ({
            fadeIn: 300,
            preset: 'rain',
            type: 'weather',
        }),
        getSummary: (node) => {
            const action = readString(node, 'action', 'start');
            if (action === 'clear') return 'clear all';

            const preset = resolveWeatherPreset(readString(node, 'preset', 'rain'));
            const label = WEATHER_PRESET_DEFAULTS[preset].label;
            const id = readString(node, 'id', WEATHER_PRESET_DEFAULTS[preset].defaultId);
            if (action === 'stop') return `stop ${label}`;

            const density = readNumber(node, 'density', WEATHER_PRESET_DEFAULTS[preset].density);
            return id === WEATHER_PRESET_DEFAULTS[preset].defaultId
                ? label
                : `${label} | ${id} | ${density}`;
        },
        icon: (size) => <CloudRain color={t.accent.blue} size={size} />,
        Inspector: asInspector(WeatherInspector),
        quickColor: { bg: t.bg.panelAlt, border: t.accent.blue },
    },
};

function resolveWeatherPreset(value: string): WeatherPreset {
    return value in WEATHER_PRESET_DEFAULTS
        ? value as WeatherPreset
        : 'rain';
}

