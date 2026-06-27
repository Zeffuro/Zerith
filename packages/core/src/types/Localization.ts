import type { BaseCommand } from './Commands';

export interface BaseLocalizationReference {
    kind: 'choice-option' | 'dialogue';
    lineId: string;
    namespace?: string;
    path: number[];
    text: string;
}

export interface ChoiceOptionLocalizationReference extends BaseLocalizationReference {
    choiceId?: string;
    kind: 'choice-option';
    optionId?: string;
}

export interface DialogueLocalizationReference {
    kind?: 'dialogue';
    lineId: string;
    namespace?: string;
    path: number[];
    text: string;
}

export interface LocaleBundle {
    $schema?: string;
    locale: string;
    namespaces: Record<string, Record<string, string>>;
    schemaVersion?: 1 | 2;
}

export interface LocaleEntryReference {
    lineId: string;
    namespace: string;
}

export type LocalizableCommand = {
    body?: BaseCommand[];
    commands?: BaseCommand[];
    lineId?: string;
    onFalse?: BaseCommand[];
    onTrue?: BaseCommand[];
    options?: Array<{
        commands?: BaseCommand[];
        id?: string;
        label?: string;
        labelId?: string;
    }>;
    text?: string;
} & BaseCommand;

export interface LocalizationConfig {
    defaultLocale?: string;
    locales?: Record<string, LocaleBundle | string>;
}

export interface LocalizationCoverageResult {
    missing: TextLocalizationReference[];
    references: TextLocalizationReference[];
    unused: LocaleEntryReference[];
}

export type TextLocalizationReference = ChoiceOptionLocalizationReference | DialogueLocalizationReference;
