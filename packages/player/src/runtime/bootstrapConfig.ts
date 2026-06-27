import type { EngineConfig } from 'core';

export function mergeEngineConfigs(...configs: (EngineConfig | undefined)[]): EngineConfig {
    const merged: EngineConfig = {};

    for (const config of configs) {
        if (!config) continue;

        const accessibility = merged.accessibility;
        const audio = merged.audio;
        const display = merged.display;
        const input = merged.input;
        const notifications = merged.notifications;
        const overlay = merged.overlay;
        const preview = merged.preview;
        const startScreen = merged.startScreen;
        const text = merged.text;
        const theme = merged.theme;

        Object.assign(merged, config);
        merged.accessibility = { ...accessibility, ...config.accessibility };
        merged.audio = { ...audio, ...config.audio };
        merged.display = { ...display, ...config.display };
        merged.input = { ...input, ...config.input };
        merged.notifications = { ...notifications, ...config.notifications };
        merged.overlay = { ...overlay, ...config.overlay };
        merged.preview = { ...preview, ...config.preview };
        merged.startScreen = { ...startScreen, ...config.startScreen };
        merged.text = { ...text, ...config.text };
        merged.theme = { ...theme, ...config.theme };
    }

    return merged;
}
