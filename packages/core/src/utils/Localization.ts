import type {
    BaseCommand,
    DialogueLocalizationReference,
    LocaleBundle,
    LocaleEntryReference,
    LocalizableCommand,
    LocalizationCoverageResult,
    TextLocalizationReference,
} from '../types';

export interface CollectDialogueLocalizationOptions {
    namespace?: string;
}

export interface ResolveLocalizedTextOptions {
    fallback?: string;
    namespace?: string;
}

export function collectDialogueLocalizationReferences(
    commands: BaseCommand[],
    options: CollectDialogueLocalizationOptions = {},
): DialogueLocalizationReference[] {
    return collectTextLocalizationReferences(commands, options)
        .filter((reference): reference is DialogueLocalizationReference => reference.kind === 'dialogue');
}

export function collectTextLocalizationReferences(
    commands: BaseCommand[],
    options: CollectDialogueLocalizationOptions = {},
): TextLocalizationReference[] {
    const references: TextLocalizationReference[] = [];
    visitCommands(commands, [], (command, path) => {
        const localizable = command as LocalizableCommand;
        if (command.type === 'dialogue') {
            if (typeof localizable.lineId !== 'string' || !localizable.lineId.trim()) return;
            if (typeof localizable.text !== 'string') return;

            references.push({
                kind: 'dialogue',
                lineId: localizable.lineId,
                namespace: options.namespace,
                path,
                text: localizable.text,
            });
            return;
        }

        if (command.type === 'choice' && Array.isArray(localizable.options)) {
            for (const option of localizable.options) {
                if (typeof option.labelId !== 'string' || !option.labelId.trim()) continue;
                if (typeof option.label !== 'string') continue;

                references.push({
                    choiceId: typeof localizable.id === 'string' ? localizable.id : undefined,
                    kind: 'choice-option',
                    lineId: option.labelId,
                    namespace: options.namespace,
                    optionId: typeof option.id === 'string' ? option.id : undefined,
                    path,
                    text: option.label,
                });
            }
        }
    });

    return references;
}

export function resolveLocalizedText(
    bundle: LocaleBundle,
    lineId: string,
    options: ResolveLocalizedTextOptions = {},
): string | undefined {
    if (options.namespace) {
        return bundle.namespaces[options.namespace]?.[lineId] ?? options.fallback;
    }

    for (const namespace of Object.values(bundle.namespaces)) {
        const value = namespace[lineId];
        if (value !== undefined) {
            return value;
        }
    }

    return options.fallback;
}

export function validateLocalizationCoverage(
    bundle: LocaleBundle,
    references: TextLocalizationReference[],
): LocalizationCoverageResult {
    const usedEntries = new Set<string>();
    const missing: TextLocalizationReference[] = [];

    for (const reference of references) {
        const resolved = resolveLocalizedText(bundle, reference.lineId, {
            namespace: reference.namespace,
        });

        if (resolved === undefined) {
            missing.push(reference);
            continue;
        }

        usedEntries.add(toEntryKey(reference.namespace, reference.lineId));
    }

    return {
        missing,
        references,
        unused: collectUnusedEntries(bundle, usedEntries),
    };
}

function collectUnusedEntries(bundle: LocaleBundle, usedEntries: Set<string>): LocaleEntryReference[] {
    const unused: LocaleEntryReference[] = [];

    for (const [namespace, entries] of Object.entries(bundle.namespaces)) {
        for (const lineId of Object.keys(entries)) {
            if (!usedEntries.has(toEntryKey(namespace, lineId))) {
                unused.push({ lineId, namespace });
            }
        }
    }

    return unused.toSorted((left, right) => (
        left.namespace.localeCompare(right.namespace)
        || left.lineId.localeCompare(right.lineId)
    ));
}

function toEntryKey(namespace: string | undefined, lineId: string): string {
    return `${namespace ?? '*'}:${lineId}`;
}

function visitCommands(
    commands: BaseCommand[],
    basePath: number[],
    visitor: (command: BaseCommand, path: number[]) => void,
): void {
    for (const [index, command] of commands.entries()) {
        const path = [...basePath, index];
        visitor(command, path);

        const localizable = command as LocalizableCommand;
        visitNestedCommands(localizable.commands, [...path, 0], visitor);
        visitNestedCommands(localizable.onFalse, [...path, 1], visitor);
        visitNestedCommands(localizable.onTrue, [...path, 2], visitor);
        visitNestedCommands(localizable.body, [...path, 3], visitor);

        if (Array.isArray(localizable.options)) {
            for (const [optionIndex, option] of localizable.options.entries()) {
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
