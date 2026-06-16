import type { Container } from 'pixi.js';

import { describe, expect, it } from 'vitest';

import type { SaveState } from '../../managers/SaveManager';

import {
    createDisplayManagerMock,
    createEventBusMock,
    createStateManagerMock,
} from '../../test-utils/audioHarness';
import { createDefaultSystemState } from '../../types';
import { WEATHER_PRESET_DEFAULTS, WeatherHandler } from '../WeatherHandler';

describe('WeatherHandler', () => {
    it('starts built-in weather presets with their default effect id', () => {
        const display = createDisplayManagerMock();
        const events = createEventBusMock();
        const state = createStateManagerMock();
        const handler = new WeatherHandler(display, state, events);

        handler.execute({
            fadeIn: 0,
            preset: 'heavy_rain',
            type: 'weather',
        });

        const [effectContainer] = display.layers.foregroundEffects.children as Container[];
        expect(effectContainer).toBeDefined();
        expect(effectContainer.children).toHaveLength(WEATHER_PRESET_DEFAULTS.heavy_rain.density);
        expect(state.system.weather.rain?.preset).toBe('heavy_rain');
        expect(state.system.weather.rain?.density).toBe(WEATHER_PRESET_DEFAULTS.heavy_rain.density);

        handler.reset();
    });

    it('stops a named weather effect and removes persisted state', () => {
        const display = createDisplayManagerMock();
        const events = createEventBusMock();
        const state = createStateManagerMock();
        const handler = new WeatherHandler(display, state, events);

        handler.execute({ action: 'start', density: 2, preset: 'snowfall', type: 'weather' });
        handler.execute({ action: 'stop', fadeOut: 0, preset: 'snowfall', type: 'weather' });

        expect(display.layers.foregroundEffects.children).toHaveLength(0);
        expect(state.system.weather.snow).toBeUndefined();

        handler.reset();
    });

    it('restores saved weather when state is loaded', () => {
        const display = createDisplayManagerMock();
        const events = createEventBusMock();
        const state = createStateManagerMock();
        const handler = new WeatherHandler(display, state, events);
        const saveData: SaveState = {
            index: 0,
            meta: {
                savedAt: 0,
                sceneName: 'intro',
                slot: 1,
            },
            sceneName: 'intro',
            state: {},
            system: {
                ...createDefaultSystemState(),
                weather: {
                    embers: {
                        density: 4,
                        id: 'embers',
                        layer: 'background',
                        preset: 'embers',
                    },
                },
            },
        };

        events.emit('state:loaded', saveData);

        const [effectContainer] = display.layers.background.children as Container[];
        expect(effectContainer).toBeDefined();
        expect(effectContainer.children).toHaveLength(4);
        expect(state.system.weather.embers?.preset).toBe('embers');

        handler.reset();
    });

    it('can render weather on a custom display layer', () => {
        const display = createDisplayManagerMock();
        const events = createEventBusMock();
        const state = createStateManagerMock();
        const handler = new WeatherHandler(display, state, events);

        handler.execute({ density: 2, layer: 'mist', preset: 'ashfall', type: 'weather' });

        expect(display.layers.mist?.children).toHaveLength(1);
        expect(display.layers.mist?.children[0]?.children).toHaveLength(2);
        expect(state.system.weather.ash?.layer).toBe('mist');

        handler.reset();
    });
});
