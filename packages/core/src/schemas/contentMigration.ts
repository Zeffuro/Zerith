import type { BaseCommand, GameManifest, SceneFile } from '../types';

import {
    type ContentSchemaVersion,
    CURRENT_CONTENT_SCHEMA_VERSION,
    LEGACY_CONTENT_SCHEMA_VERSION,
} from './contentVersionSchemas';

export interface GameManifestMigrationResult {
    changed: boolean;
    manifest: GameManifest;
}

export interface SceneFileMigrationOptions {
    localeNamespace?: string;
    preserveExistingIds?: boolean;
    sceneId?: string;
}

export interface SceneFileMigrationResult {
    changed: boolean;
    fromSchemaVersion: ContentSchemaVersion;
    scene: SceneFile;
}

type ChoiceOption = {
    [key: string]: unknown;
    commands?: unknown;
    id?: unknown;
    label?: unknown;
    labelId?: unknown;
};

type CommandMigrationContext = {
    idPrefix: string;
    path: number[];
    preserveExistingIds: boolean;
};

type CommandWithNestedScripts = {
    body?: unknown;
    commands?: unknown;
    onFalse?: unknown;
    onTrue?: unknown;
    options?: unknown;
} & BaseCommand;

type SceneEnvelopeInput = {
    $schema?: unknown;
    commands?: unknown;
    graph?: unknown;
    id?: unknown;
    localeNamespace?: unknown;
    schemaVersion?: unknown;
};

export function migrateGameManifestToCurrent(manifest: GameManifest): GameManifestMigrationResult {
    const nextManifest = {
        ...manifest,
        schemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
    };

    return {
        changed: manifest.schemaVersion !== CURRENT_CONTENT_SCHEMA_VERSION,
        manifest: nextManifest,
    };
}

export function migrateSceneFileToCurrent(
    value: unknown,
    options: SceneFileMigrationOptions = {},
): SceneFileMigrationResult {
    const envelope = isRecord(value) && Array.isArray(value.commands)
        ? value as SceneEnvelopeInput
        : undefined;
    const sourceCommands = envelope ? envelope.commands : value;

    if (!Array.isArray(sourceCommands)) {
        throw new TypeError('Scene migration expected a command array or scene object with a commands array.');
    }

    const fromSchemaVersion = envelope?.schemaVersion === CURRENT_CONTENT_SCHEMA_VERSION
        ? CURRENT_CONTENT_SCHEMA_VERSION
        : LEGACY_CONTENT_SCHEMA_VERSION;
    const sceneId = options.sceneId ?? toOptionalString(envelope?.id) ?? 'scene';
    const localeNamespace = options.localeNamespace
        ?? toOptionalString(envelope?.localeNamespace)
        ?? `scene.${sceneId}`;
    const idPrefix = toStableIdPrefix(localeNamespace);
    const preserveExistingIds = options.preserveExistingIds ?? true;
    const commands = migrateCommands(sourceCommands, {
        idPrefix,
        path: [],
        preserveExistingIds,
    });

    const scene: SceneFile = {
        ...toSceneMetadata(envelope),
        $schema: toOptionalString(envelope?.$schema) ?? 'zerith/scene',
        commands,
        id: sceneId,
        localeNamespace,
        schemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
    };

    return {
        changed: fromSchemaVersion !== CURRENT_CONTENT_SCHEMA_VERSION
            || commands !== sourceCommands
            || scene.id !== envelope?.id
            || scene.localeNamespace !== envelope?.localeNamespace,
        fromSchemaVersion,
        scene,
    };
}

function formatPathSegment(value: number): string {
    return value.toString().padStart(3, '0');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function migrateChoiceOptions(
    command: CommandWithNestedScripts,
    context: CommandMigrationContext,
): CommandWithNestedScripts {
    if (!Array.isArray(command.options)) {
        return command;
    }

    const sourceOptions = command.options as unknown[];
    let changed = false;
    const choiceId = typeof command.id === 'string' && command.id.trim()
        ? command.id
        : stableId(context, 'choice');
    const options: unknown[] = sourceOptions.map((option: unknown, index): unknown => {
        if (!isRecord(option)) {
            return option;
        }

        let nextOption = option as ChoiceOption;
        const optionId = `${choiceId}.option.${formatPathSegment(index + 1)}`;
        nextOption = setStableStringField(nextOption, 'id', optionId, context.preserveExistingIds);
        const resolvedOptionId = typeof nextOption.id === 'string' && nextOption.id.trim()
            ? nextOption.id
            : optionId;

        if (typeof nextOption.label === 'string') {
            nextOption = setStableStringField(
                nextOption,
                'labelId',
                `${resolvedOptionId}.label`,
                context.preserveExistingIds,
            );
        }

        if (Array.isArray(nextOption.commands)) {
            const commands = migrateCommands(nextOption.commands, {
                ...context,
                path: [...context.path, index + 1],
            });
            if (commands !== nextOption.commands) {
                nextOption = { ...nextOption, commands };
            }
        }

        changed ||= nextOption !== option;
        return nextOption;
    });

    return changed ? { ...command, options } : command;
}

function migrateCommand(command: CommandWithNestedScripts, context: CommandMigrationContext): BaseCommand {
    let nextCommand: CommandWithNestedScripts = command;

    if (command.type === 'dialogue') {
        nextCommand = setStableStringField(
            nextCommand,
            'lineId',
            stableId(context, 'line'),
            context.preserveExistingIds,
        );
    }

    if (command.type === 'choice') {
        nextCommand = setStableStringField(
            nextCommand,
            'id',
            stableId(context, 'choice'),
            context.preserveExistingIds,
        );
        nextCommand = migrateChoiceOptions(nextCommand, context);
    }

    nextCommand = migrateNestedCommandArray(nextCommand, 'commands', context);
    nextCommand = migrateNestedCommandArray(nextCommand, 'onFalse', context);
    nextCommand = migrateNestedCommandArray(nextCommand, 'onTrue', context);
    nextCommand = migrateNestedCommandArray(nextCommand, 'body', context);

    return nextCommand;
}

function migrateCommands(commands: unknown[], context: CommandMigrationContext): BaseCommand[] {
    let changed = false;
    const nextCommands = commands.map((command, index) => {
        if (!isRecord(command) || typeof command.type !== 'string') {
            return command as BaseCommand;
        }

        const nextCommand = migrateCommand(command as CommandWithNestedScripts, {
            ...context,
            path: [...context.path, index + 1],
        });
        changed ||= nextCommand !== command;
        return nextCommand;
    });

    return changed ? nextCommands : commands as BaseCommand[];
}

function migrateNestedCommandArray<T extends CommandWithNestedScripts>(
    command: T,
    key: 'body' | 'commands' | 'onFalse' | 'onTrue',
    context: CommandMigrationContext,
): T {
    const nested = command[key];
    if (!Array.isArray(nested)) {
        return command;
    }

    const commands = migrateCommands(nested, context);
    return commands === nested ? command : { ...command, [key]: commands };
}

function setStableStringField<T extends Record<string, unknown>>(
    value: T,
    field: string,
    fallback: string,
    preserveExistingIds: boolean,
): T {
    const existingValue = value[field];
    if (preserveExistingIds && typeof existingValue === 'string' && existingValue.trim()) {
        return value;
    }

    return { ...value, [field]: fallback };
}

function stableId(context: CommandMigrationContext, kind: 'choice' | 'line'): string {
    const path = context.path.map((segment) => formatPathSegment(segment)).join('.');
    return `${context.idPrefix}.${kind}.${path}`;
}

function toOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined;
}

function toSceneMetadata(envelope: SceneEnvelopeInput | undefined): Omit<SceneFile, '$schema' | 'commands' | 'id' | 'localeNamespace' | 'schemaVersion'> {
    const graph = isRecord(envelope?.graph) ? envelope.graph : undefined;

    return graph ? { graph } : {};
}

function toStableIdPrefix(value: string): string {
    const normalized = value
        .trim()
        .replaceAll(/[^a-zA-Z0-9_.-]+/gu, '.')
        .replaceAll(/^\.+|\.+$/gu, '');

    return normalized || 'scene';
}
