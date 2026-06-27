import { describe, expect, it } from 'vitest';

import { parseEngineConfig } from '../EngineConfig';
import { CURRENT_CONTENT_SCHEMA_VERSION, EngineConfigSchema } from '../schemas/index';

const disabledDefaultBlipUrl = JSON.parse('null') as null;

describe('EngineConfigSchema', () => {
    it('accepts valid display and theme overrides', () => {
        const parsed = EngineConfigSchema.safeParse({
            $schema: 'zerith/engine-config',
            accessibility: {
                captions: true,
                highContrast: true,
                reducedMotion: true,
                selfVoicing: true,
                textScale: 1.25,
                typewriterSpeedMultiplier: 0.5,
            },
            audio: {
                defaultBlipUrl: disabledDefaultBlipUrl,
            },
            display: {
                height: 720,
                layers: [
                    { id: 'mist', order: 250 },
                ],
                scaleMode: 'fit',
                width: 1280,
            },
            input: {
                advanceKeys: ['Enter', 'Space'],
                gamepadConfirmButton: 0,
                navigateDownKeys: ['ArrowDown', 'j'],
                navigateUpKeys: ['ArrowUp', 'k'],
                saveKey: 'F5',
            },
            preview: {
                fontAssetUrl: '/assets/fonts/custom.ttf',
                useDisplayConfig: false,
            },
            schemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
            text: {
                markupMode: 'plain',
            },
            theme: {
                boxColor: 0x00_00_33,
                fontFamily: 'Courier New',
                fontSize: 24,
            },
        });

        expect(parsed.success).toBe(true);
    });

    it('rejects invalid display values', () => {
        const parsed = EngineConfigSchema.safeParse({
            display: {
                height: -100,
                scaleMode: 'bogus',
                width: 0,
            },
        });

        expect(parsed.success).toBe(false);
    });

    it('rejects invalid accessibility values', () => {
        const parsed = EngineConfigSchema.safeParse({
            accessibility: {
                captions: 'yes',
                textScale: 3,
                typewriterSpeedMultiplier: -1,
            },
        });

        expect(parsed.success).toBe(false);
    });

    it('rejects invalid input remapping values', () => {
        const parsed = EngineConfigSchema.safeParse({
            input: {
                advanceKeys: ['Enter', ''],
                gamepadConfirmButton: -1,
            },
        });

        expect(parsed.success).toBe(false);
    });

    it('rejects invalid text markup modes', () => {
        const parsed = EngineConfigSchema.safeParse({
            text: {
                markupMode: 'markdown',
            },
        });

        expect(parsed.success).toBe(false);
    });

    it('parses config through parseEngineConfig helper', () => {
        const parsed = parseEngineConfig({
            audio: {
                masterVolume: 0.5,
                muted: false,
            },
        });

        expect(parsed.success).toBe(true);
    });
});

