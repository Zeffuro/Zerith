import { describe, expect, it, vi } from 'vitest';

import type { IStateManager } from '../../../interfaces/managers';
import type { SaveState } from '../../../managers/SaveManager';
import type { SpriteCommand } from '../types';

import { createDefaultSystemState } from '../../../types';
import { SpriteStateSerializer } from '../SpriteStateSerializer';

describe('SpriteStateSerializer', () => {
    it('restores saved ratio placement and sizing instead of fixed pixels and scales', () => {
        const commands: SpriteCommand[] = [];
        const state = {
            system: createDefaultSystemState(),
        } as IStateManager;
        const serializer = new SpriteStateSerializer(state, vi.fn((command: SpriteCommand) => {
            commands.push(command);
            return Promise.resolve();
        }));

        serializer.handleStateLoaded({
            index: 0,
            meta: { savedAt: 0, sceneName: 'intro', slot: 1 },
            sceneName: 'intro',
            state: {},
            system: {
                items: [],
                sprites: {
                    juno: {
                        fit: 'contain',
                        heightRatio: 0.8,
                        pose: 'normal',
                        scaleX: 0.8,
                        scaleY: 0.8,
                        widthRatio: 0.25,
                        x: 384,
                        xRatio: 0.3,
                        y: 720,
                        yRatio: 1,
                    },
                },
                weather: {},
            },
        } satisfies SaveState);

        expect(commands[0]).toMatchObject({
            action: 'show',
            fit: 'contain',
            heightRatio: 0.8,
            id: 'juno',
            pose: 'normal',
            type: 'sprite',
            widthRatio: 0.25,
            xRatio: 0.3,
            yRatio: 1,
        });
        expect(commands[0]?.scaleX).toBeUndefined();
        expect(commands[0]?.scaleY).toBeUndefined();
        expect(commands[0]?.x).toBeUndefined();
        expect(commands[0]?.y).toBeUndefined();
    });

    it('preserves untouched move-axis ratios and clears ratios for absolute axis moves', () => {
        const state = {
            system: createDefaultSystemState(),
        } as IStateManager;
        state.system.sprites.juno = {
            x: 384,
            xRatio: 0.3,
            y: 720,
            yRatio: 1,
        };
        const serializer = new SpriteStateSerializer(state, vi.fn());

        serializer.saveMove('juno', {
            clearXRatio: true,
            x: 420,
            y: 720,
        });

        expect(state.system.sprites.juno).toMatchObject({
            x: 420,
            y: 720,
            yRatio: 1,
        });
        expect(state.system.sprites.juno?.xRatio).toBeUndefined();
    });
});
