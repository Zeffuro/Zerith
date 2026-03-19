import { describe, expect, it } from 'vitest';

import { parseEngineConfig } from '../EngineConfig';
import { EngineConfigSchema } from '../schemas/index';

describe('EngineConfigSchema', () => {
    it('accepts valid display and theme overrides', () => {
        const parsed = EngineConfigSchema.safeParse({
            $schema: 'zerith/engine-config',
            display: {
                height: 720,
                scaleMode: 'fit',
                width: 1280,
            },
            preview: {
                fontAssetUrl: '/assets/fonts/custom.ttf',
                useDisplayConfig: false,
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

