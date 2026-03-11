import type { CommandPlugin, EditorCommandType } from '../types';

import { audioPluginOverrides } from './audioPlugins';
import { contentPluginOverrides } from './contentPlugins';
import { effectPluginOverrides } from './effectPlugins';
import { flowPluginOverrides } from './flowPlugins';

export const PLUGIN_OVERRIDES: Partial<Record<EditorCommandType, Partial<CommandPlugin>>> = {
    ...audioPluginOverrides,
    ...contentPluginOverrides,
    ...effectPluginOverrides,
    ...flowPluginOverrides,
};

