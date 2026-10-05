import type { EngineConfigFile } from '@zeffuro/zerith-core';

import { describe, expect, it } from 'vitest';

import { EngineConfigSchema } from '../../../../../../core/src/schemas/engineConfigSchemas';
import {
    movePlayerConfigAction,
    PLAYER_MENU_DEFAULTS,
    readPlayerConfigActions,
    reorderPlayerConfigAction,
    resetPlayerConfig,
    setPlayerConfigAction,
    setPlayerConfigField,
    setPlayerConfigLabel,
} from '../playerConfigModel';

describe('player menu authoring', () => {
    it('round trips every authored field and label with the engine schema', () => {
        let config = setPlayerConfigField({}, 'enabled', false);
        config = setPlayerConfigField(config, 'rememberSettings', false);
        config = setPlayerConfigField(config, 'title', 'A custom title');
        config = setPlayerConfigField(config, 'subtitle', 'The next chapter');
        config = setPlayerConfigField(config, 'background', 'assets/bg/title.webp');
        config = setPlayerConfigField(config, 'accentColor', '#123456');
        config = setPlayerConfigField(config, 'saveSlots', 12);
        config = setPlayerConfigLabel(config, 'settings', 'Options');
        const text = JSON.stringify(config);
        const serialized: unknown = JSON.parse(text);
        const parsed = EngineConfigSchema.safeParse(serialized);
        expect(parsed.success).toBe(true);
        if (!parsed.success) throw new Error('Authored player fields must validate');
        expect(parsed.data.player).toEqual({
            accentColor: '#123456', actionLabels: { settings: 'Options' }, background: 'assets/bg/title.webp',
            enabled: false, rememberSettings: false, saveSlots: 12, subtitle: 'The next chapter', title: 'A custom title',
        });
    });

    it('preserves surrounding and unknown data through edits and scoped default reset', () => {
        const original = { custom: { nested: ['untouched'] }, display: { width: 1920 }, player: { customPlayer: true, enabled: false, title: 'Changed' }, theme: { fontFamily: 'serif' } };
        const edited = setPlayerConfigField(original, 'saveSlots', 8);
        expect(edited).toMatchObject(original);
        expect(original.player).not.toHaveProperty('saveSlots');
        expect(resetPlayerConfig(edited)).toEqual({ ...original, player: { customPlayer: true } });
        expect(resetPlayerConfig({ player: { enabled: false, title: 'Changed' } })).toEqual({});
    });

    it('round trips all appearance fields and resets only known overrides', () => {
        const appearance = {
            backgroundOpacity: .3, buttonColor: '#123456', buttonHeight: 60, cornerStyle: 'pill',
            menuFont: 'serif', menuFontSize: 20, menuWidth: 500, panelColor: '#654321', panelOpacity: .8,
            textColor: '#eeeeee', titleAlignment: 'center',
        } as const;
        const parsed = EngineConfigSchema.safeParse({ player: appearance });
        expect(parsed.success).toBe(true);
        const withUnknown = { player: { ...appearance, future: true } };
        expect(resetPlayerConfig(withUnknown)).toEqual({ player: { future: true } });
        for (const [key, value] of Object.entries({ backgroundOpacity: -.1, buttonColor: -1, buttonHeight: 43, cornerStyle: 'custom', menuFont: 'url(unsafe)', menuFontSize: 25, menuWidth: 601, panelColor: 'red', panelOpacity: 1.1, textColor: '#fff', titleAlignment: 'top' })) {
            expect(EngineConfigSchema.safeParse({ player: { [key]: value } }).success, key).toBe(false);
        }
    });

    it('moves an enabled action directly onto another enabled action and retains hidden items', () => {
        const config: EngineConfigFile = { player: { titleActions: ['new-game', 'settings', 'load'] } };
        const moved = reorderPlayerConfigAction(config, 'titleActions', 'load', 'new-game');
        expect(readPlayerConfigActions(moved.player, 'titleActions')).toEqual(['load', 'new-game', 'settings']);
        expect(reorderPlayerConfigAction(config, 'titleActions', 'continue', 'new-game')).toBe(config);
        expect(config.player?.titleActions).toEqual(['new-game', 'settings', 'load']);
    });

    it('empty fields and labels restore their individual defaults', () => {
        let config = setPlayerConfigField({}, 'title', 'Title');
        config = setPlayerConfigField(config, 'title', ' ');
        config = setPlayerConfigField(config, 'saveSlots', 12);
        config = setPlayerConfigField(config, 'saveSlots', undefined);
        config = setPlayerConfigLabel(config, 'load', 'Open');
        config = setPlayerConfigLabel(config, 'load', '');
        expect(config.player).toEqual({});
    });

    it.each(['pauseActions', 'titleActions'] as const)('edits visibility and order for every %s item with required recovery', menu => {
        let config: EngineConfigFile = {};
        const defaults = PLAYER_MENU_DEFAULTS[menu];
        expect(readPlayerConfigActions(undefined, menu)).toEqual(defaults);
        const required = menu === 'titleActions' ? 'new-game' : 'resume';
        for (const action of defaults) config = setPlayerConfigAction(config, menu, action, false);
        expect(readPlayerConfigActions(config.player, menu)).toEqual([required]);
        for (const action of defaults.filter(action => action !== required)) config = setPlayerConfigAction(config, menu, action, true);
        expect(readPlayerConfigActions(config.player, menu)).toEqual(defaults);
        const last = defaults.at(-1)!;
        config = movePlayerConfigAction(config, menu, last, -1);
        expect(readPlayerConfigActions(config.player, menu).at(-2)).toBe(last);
        config = movePlayerConfigAction(config, menu, last, 1);
        expect(readPlayerConfigActions(config.player, menu)).toEqual(defaults);
        expect(movePlayerConfigAction(config, menu, required, -1)).toBe(config);
    });

    it('normalizes malformed action lists and rejects invalid authored fields through schema', () => {
        expect(readPlayerConfigActions({ pauseActions: [] }, 'pauseActions')).toEqual(['resume']);
        expect(readPlayerConfigActions({ titleActions: ['quit'] }, 'titleActions')).toEqual(PLAYER_MENU_DEFAULTS.titleActions);
        expect(EngineConfigSchema.safeParse(setPlayerConfigField({}, 'saveSlots', 0)).success).toBe(false);
        expect(EngineConfigSchema.safeParse(setPlayerConfigField({}, 'saveSlots', 25)).success).toBe(false);
        expect(EngineConfigSchema.safeParse(setPlayerConfigField({}, 'accentColor', 'invalid')).success).toBe(false);
        expect(EngineConfigSchema.safeParse(setPlayerConfigLabel({}, 'load', 'x'.repeat(81))).success).toBe(false);
    });
});
