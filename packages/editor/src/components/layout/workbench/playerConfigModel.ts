import type { EngineConfigFile } from '@zeffuro/zerith-core';

import { isRecord } from '../../../utils/typeGuards';

export type PlayerConfigAction = 'continue' | 'history' | 'load' | 'new-game' | 'resume' | 'save' | 'settings' | 'title';
export type PlayerConfigField = 'accentColor' | 'background' | 'backgroundOpacity' | 'buttonColor' | 'buttonHeight' | 'cornerStyle' | 'enabled' | 'menuFont' | 'menuFontSize' | 'menuWidth' | 'panelColor' | 'panelOpacity' | 'rememberSettings' | 'saveSlots' | 'subtitle' | 'textColor' | 'title' | 'titleAlignment';
export type PlayerConfigMenu = 'pauseActions' | 'titleActions';

export const PLAYER_ACTION_LABELS: Record<PlayerConfigAction, string> = {
    continue: 'Continue',
    history: 'History',
    load: 'Load',
    'new-game': 'New Game',
    resume: 'Resume',
    save: 'Save',
    settings: 'Settings',
    title: 'Return to title',
};

export const PLAYER_MENU_DEFAULTS: Record<PlayerConfigMenu, PlayerConfigAction[]> = {
    pauseActions: ['resume', 'save', 'load', 'history', 'settings', 'title'],
    titleActions: ['new-game', 'continue', 'load', 'settings'],
};

export function movePlayerConfigAction(config: EngineConfigFile, menu: PlayerConfigMenu, action: PlayerConfigAction, direction: -1 | 1): EngineConfigFile {
    const actions = readPlayerConfigActions(config.player, menu);
    const index = actions.indexOf(action);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= actions.length) return config;
    [actions[index], actions[nextIndex]] = [actions[nextIndex], actions[index]];
    return { ...config, player: { ...readPlayerConfigRecord(config.player), [menu]: actions } };
}

export function readPlayerConfigActions(value: unknown, menu: PlayerConfigMenu): PlayerConfigAction[] {
    const input = readPlayerConfigRecord(value)[menu];
    const defaults = PLAYER_MENU_DEFAULTS[menu];
    const actions = Array.isArray(input) && input.every((action: unknown) => defaults.includes(action as PlayerConfigAction))
        ? [...new Set(input as PlayerConfigAction[])] : [...defaults];
    const required = requiredPlayerConfigAction(menu);
    return actions.includes(required) ? actions : [required, ...actions];
}

export function readPlayerConfigRecord(value: unknown): Record<string, unknown> {
    return isRecord(value) ? value : {};
}

export function reorderPlayerConfigAction(config: EngineConfigFile, menu: PlayerConfigMenu, action: PlayerConfigAction, target: PlayerConfigAction): EngineConfigFile {
    const actions = readPlayerConfigActions(config.player, menu);
    const from = actions.indexOf(action);
    const to = actions.indexOf(target);
    if (from === -1 || to === -1 || from === to) return config;
    actions.splice(from, 1);
    actions.splice(to, 0, action);
    return { ...config, player: { ...readPlayerConfigRecord(config.player), [menu]: actions } };
}

export function requiredPlayerConfigAction(menu: PlayerConfigMenu): PlayerConfigAction {
    return menu === 'titleActions' ? 'new-game' : 'resume';
}

export function resetPlayerConfig(config: EngineConfigFile): EngineConfigFile {
    const player = { ...readPlayerConfigRecord(config.player) };
    for (const key of ['backgroundOpacity', 'buttonColor', 'buttonHeight', 'cornerStyle', 'menuFont', 'menuFontSize', 'menuWidth', 'panelColor', 'panelOpacity', 'textColor', 'titleAlignment', 'accentColor', 'actionLabels', 'background', 'enabled', 'pauseActions', 'rememberSettings', 'saveSlots', 'subtitle', 'title', 'titleActions']) {
        delete player[key];
    }
    const next = { ...config };
    if (Object.keys(player).length > 0) next.player = player;
    else delete next.player;
    return next;
}

export function setPlayerConfigAction(config: EngineConfigFile, menu: PlayerConfigMenu, action: PlayerConfigAction, visible: boolean): EngineConfigFile {
    if (!PLAYER_MENU_DEFAULTS[menu].includes(action) || (!visible && action === requiredPlayerConfigAction(menu))) return config;
    const actions = readPlayerConfigActions(config.player, menu).filter(item => item !== action);
    if (visible) actions.push(action);
    return { ...config, player: { ...readPlayerConfigRecord(config.player), [menu]: actions } };
}

export function setPlayerConfigField(config: EngineConfigFile, key: PlayerConfigField, value: boolean | number | string | undefined): EngineConfigFile {
    const player = { ...readPlayerConfigRecord(config.player) };
    if (value === undefined || (typeof value === 'string' && value.trim().length === 0)) delete player[key];
    else player[key] = value;
    return { ...config, player };
}

export function setPlayerConfigLabel(config: EngineConfigFile, action: PlayerConfigAction, value: string): EngineConfigFile {
    const player = { ...readPlayerConfigRecord(config.player) };
    const labels = { ...readPlayerConfigRecord(player.actionLabels) };
    if (value.trim().length === 0) delete labels[action];
    else labels[action] = value;
    if (Object.keys(labels).length > 0) player.actionLabels = labels;
    else delete player.actionLabels;
    return { ...config, player };
}
