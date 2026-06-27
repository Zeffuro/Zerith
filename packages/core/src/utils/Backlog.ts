import type { BaseCommand, DialogueBacklogEntry } from '../types';

export interface CollectDialogueBacklogOptions {
    includeHidden?: boolean;
    namespace?: string;
    sceneName?: string;
}

type BacklogDialogueCommand = {
    backlogVisibility?: 'hide' | 'show';
    expressionRef?: string;
    lineId?: string;
    speaker?: string;
    tags?: string[];
    text?: string;
    voice?: unknown;
} & CommandWithNestedScripts;

type CommandWithNestedScripts = {
    body?: BaseCommand[];
    commands?: BaseCommand[];
    onFalse?: BaseCommand[];
    onTrue?: BaseCommand[];
    options?: Array<{
        commands?: BaseCommand[];
    }>;
} & BaseCommand;

export function collectDialogueBacklogEntries(
    commands: BaseCommand[],
    options: CollectDialogueBacklogOptions = {},
): DialogueBacklogEntry[] {
    const entries: DialogueBacklogEntry[] = [];
    const includeHidden = options.includeHidden ?? false;

    visitCommands(commands, [], (command, path) => {
        if (command.type !== 'dialogue') return;

        const dialogue = command as BacklogDialogueCommand;
        const backlogVisibility = dialogue.backlogVisibility ?? 'show';
        if (backlogVisibility === 'hide' && !includeHidden) return;
        if (typeof dialogue.speaker !== 'string' || typeof dialogue.text !== 'string') return;

        entries.push({
            backlogVisibility,
            expressionRef: dialogue.expressionRef,
            lineId: dialogue.lineId,
            namespace: options.namespace,
            path,
            sceneName: options.sceneName,
            speaker: dialogue.speaker,
            tags: dialogue.tags ?? [],
            text: dialogue.text,
            voice: dialogue.voice,
        });
    });

    return entries;
}

function visitCommands(
    commands: BaseCommand[],
    basePath: number[],
    visitor: (command: BaseCommand, path: number[]) => void,
): void {
    for (const [index, command] of commands.entries()) {
        const path = [...basePath, index];
        visitor(command, path);

        const nested = command as CommandWithNestedScripts;
        visitNestedCommands(nested.commands, [...path, 0], visitor);
        visitNestedCommands(nested.onFalse, [...path, 1], visitor);
        visitNestedCommands(nested.onTrue, [...path, 2], visitor);
        visitNestedCommands(nested.body, [...path, 3], visitor);

        if (Array.isArray(nested.options)) {
            for (const [optionIndex, option] of nested.options.entries()) {
                visitNestedCommands(option.commands, [...path, 4, optionIndex], visitor);
            }
        }
    }
}

function visitNestedCommands(
    commands: BaseCommand[] | undefined,
    path: number[],
    visitor: (command: BaseCommand, path: number[]) => void,
): void {
    if (!commands) return;
    visitCommands(commands, path, visitor);
}
