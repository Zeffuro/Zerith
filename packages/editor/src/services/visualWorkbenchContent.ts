import type { Command } from '@zeffuro/zerith-core';

import type { MacroEntry } from '../store/project/types';
import type { WorkbenchTab } from '../store/workbench/types';

import { isRecord } from '../utils/typeGuards';

export function serializeMacroEntries(entries: MacroEntry[], sourceText?: string): string {
    const source = parseSource(sourceText);
    const metadata = isRecord(source)
        ? Object.fromEntries(Object.entries(source).filter(([key]) => key.startsWith('$')))
        : {};
    return JSON.stringify({ ...metadata, ...Object.fromEntries(entries.map(entry => [entry.name, entry.commands])) }, undefined, 4);
}

export function serializeSceneCommands(commands: Command[], sourceText?: string): string {
    const source = parseSource(sourceText);
    return JSON.stringify(isRecord(source) && Array.isArray(source.commands) ? { ...source, commands } : commands, undefined, 4);
}

export function visualTabSourceText(tab: undefined | WorkbenchTab): string | undefined {
    return tab?.dirty ? tab.textContent ?? tab.savedTextContent : tab?.savedTextContent ?? tab?.textContent;
}

function parseSource(text: string | undefined): unknown {
    if (text === undefined) return;
    return JSON.parse(text) as unknown;
}
