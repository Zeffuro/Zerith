import { describe, expect, it } from 'vitest';

import { normalizePlayerAccentColor, normalizePlayerBackground, normalizePlayerShellConfig } from '../playerShellConfig';

describe('player shell configuration', () => {
    it('provides the complete shell by default and follows the manifest title', () => {
        expect(normalizePlayerShellConfig(undefined, 'A story')).toEqual({
            accentColor: '#ffaaaa', backgroundOpacity: .45, buttonColor: '#232a3a', buttonHeight: 44,
            cornerStyle: 'rounded', enabled: true, menuFont: 'system', menuFontSize: 16, menuWidth: 350,
            panelColor: '#151923', panelOpacity: 245 / 255,
            pauseActions: ['resume', 'save', 'load', 'history', 'settings', 'title'],
            rememberSettings: true,
            saveSlots: 6,
            textColor: '#f2f0f8',
            title: 'A story',
            titleActions: ['new-game', 'continue', 'load', 'settings'],
            titleAlignment: 'left',
        });
    });

    it('bounds appearance values and rejects CSS expressions', () => {
        expect(normalizePlayerShellConfig({
            backgroundOpacity: -1, buttonColor: 'url(unsafe)', buttonHeight: 200, cornerStyle: 'custom',
            menuFont: 'unsafe', menuFontSize: 30, menuWidth: 100, panelColor: 0x12_34_56,
            panelOpacity: 5, textColor: '#ABCDEF', titleAlignment: 'right',
        })).toMatchObject({
            backgroundOpacity: 0, buttonColor: '#232a3a', buttonHeight: 80, cornerStyle: 'rounded',
            menuFont: 'system', menuFontSize: 24, menuWidth: 220, panelColor: '#123456',
            panelOpacity: 1, textColor: '#abcdef', titleAlignment: 'right',
        });
        const defaults = normalizePlayerShellConfig();
        expect(normalizePlayerShellConfig({ menuFontSize: Infinity, panelOpacity: Number.NaN })).toEqual(defaults);
    });

    it('normalizes authored choices and bounds without mutating the source', () => {
        const input = {
            accentColor: 0x12_AB_EF,
            background: 'assets/title%20screen.webp',
            enabled: false,
            pauseActions: ['settings', 'resume', 'resume'],
            rememberSettings: false,
            saveSlots: 80,
            subtitle: ' A new adventure ',
            title: ' Custom title ',
            titleActions: [],
        };
        const config = normalizePlayerShellConfig(input, 'Fallback');
        expect(config).toMatchObject({
            accentColor: '#12abef',
            enabled: false,
            pauseActions: ['settings', 'resume'],
            rememberSettings: false,
            saveSlots: 24,
            subtitle: 'A new adventure',
            title: 'Custom title',
            titleActions: ['new-game'],
        });
        expect(input.pauseActions).toHaveLength(3);
        expect(normalizePlayerShellConfig({ saveSlots: -1 }).saveSlots).toBe(1);
    });

    it('uses deterministic fallbacks for unknown actions and malformed fields', () => {
        const defaults = normalizePlayerShellConfig();
        expect(normalizePlayerShellConfig({
            accentColor: 'var(--unsafe)',
            background: 'https://example.com/bg.png',
            enabled: 'yes',
            pauseActions: ['quit'],
            rememberSettings: 0,
            saveSlots: Number.NaN,
            subtitle: 'x'.repeat(241),
            title: ' ',
            titleActions: ['execute'],
            unknown: 'ignored',
        })).toEqual(defaults);
        expect(normalizePlayerShellConfig(Object.create({ enabled: false }) as unknown)).toEqual(defaults);
        expect(normalizePlayerShellConfig(JSON.parse('{"__proto__":{"enabled":false}}') as unknown)).toEqual(defaults);
    });

    it('keeps recovery actions reachable and accepts bounded custom action labels', () => {
        expect(normalizePlayerShellConfig({ pauseActions: [], titleActions: [] })).toMatchObject({
            pauseActions: ['resume'], titleActions: ['new-game'],
        });
        expect(normalizePlayerShellConfig({
            actionLabels: { load: ' Open a saved story ', resume: ' ', settings: 'x'.repeat(81), unknown: 'Ignored' },
            pauseActions: ['settings'],
            titleActions: ['load'],
        })).toMatchObject({
            actionLabels: { load: 'Open a saved story' },
            pauseActions: ['resume', 'settings'],
            titleActions: ['new-game', 'load'],
        });
        expect(normalizePlayerShellConfig({ actionLabels: [] }).actionLabels).toBeUndefined();
    });

    it.each(['../bg.png', '%2e%2e/bg.png', '/bg.png', '//example.com/bg.png', 'file:asset.png', 'data:image/png;base64,abc', String.raw`a\bg.png`, 'a//bg.png', 'bg.png?x=1', 'a/%00.png', 'a/\tbg.png', 'a/\nbg.png', '%zz.png'])('rejects unsafe background %s', value => {
        expect(normalizePlayerBackground(value)).toBeUndefined();
    });

    it.each([
        ['assets/bg/late train.webp', '/game/assets/bg/late%20train.webp'],
        ['assets/bg/late%20train.webp', '/game/assets/bg/late%20train.webp'],
        ['assets/bg/caf\u00E9 at night.webp', '/game/assets/bg/caf%C3%A9%20at%20night.webp'],
    ])('resolves authored background filenames through the shell URL for %s', (value, pathname) => {
        const config = normalizePlayerShellConfig({ background: value });
        expect(config.background).toBe(value);
        const resolved = new URL(config.background!, 'https://example.com/game/');
        expect(resolved.origin).toBe('https://example.com');
        expect(resolved.pathname).toBe(pathname);
    });

    it('accepts only portable relative asset paths and exact color values', () => {
        expect(normalizePlayerBackground('assets/title.webp')).toBe('assets/title.webp');
        expect(normalizePlayerAccentColor('#AbC123')).toBe('#abc123');
        expect(normalizePlayerAccentColor(0)).toBe('#000000');
        for (const value of [-1, 0x1_00_00_00, 1.5, '#fff', 'red', 'url(unsafe)']) {
            expect(normalizePlayerAccentColor(value)).toBeUndefined();
        }
    });
});
