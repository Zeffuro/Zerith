import type { BaseCommand, LocaleBundle, SceneMap, Script } from 'core';

import { resolveLocalizedText } from 'core/utils/Localization';

export const SOURCE_PREVIEW_LOCALE = '__source__';

export function localizeSceneMapForPreview(
    scenes: SceneMap,
    sceneNamespaces: Record<string, string | undefined>,
    bundle?: LocaleBundle,
): SceneMap {
    if (!bundle) return scenes;

    return Object.fromEntries(
        Object.entries(scenes).map(([sceneName, script]) => [
            sceneName,
            localizeScriptForPreview(script, bundle, sceneNamespaces[sceneName] ?? toDefaultSceneNamespace(sceneName)),
        ]),
    );
}

export function localizeScriptForPreview(
    script: Script,
    bundle?: LocaleBundle,
    namespace?: string,
): Script {
    if (!bundle) return script;
    return script.map((command) => localizeCommand(command, bundle, namespace));
}

export function resolvePreviewLocaleBundle(
    locales: Record<string, LocaleBundle>,
    previewLocale?: string,
    defaultLocale?: string,
): { bundle: LocaleBundle | undefined; locale: string | undefined } {
    const explicitLocale = previewLocale?.trim();
    if (explicitLocale === SOURCE_PREVIEW_LOCALE) {
        return { bundle: undefined, locale: undefined };
    }

    if (explicitLocale && locales[explicitLocale]) {
        return { bundle: locales[explicitLocale], locale: explicitLocale };
    }

    const fallbackLocale = defaultLocale?.trim();
    if (fallbackLocale && locales[fallbackLocale]) {
        return { bundle: locales[fallbackLocale], locale: fallbackLocale };
    }

    return { bundle: undefined, locale: undefined };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function localizeCommand(command: BaseCommand, bundle: LocaleBundle, namespace: string | undefined): BaseCommand {
    const next: BaseCommand = { ...command };

    if (
        next.type === 'dialogue'
        && typeof next.lineId === 'string'
        && typeof next.text === 'string'
    ) {
        next.text = resolveLocalizedText(bundle, next.lineId, {
            fallback: next.text,
            namespace,
        }) ?? next.text;
    }

    localizeNestedCommandArray(next, 'commands', bundle, namespace);
    localizeNestedCommandArray(next, 'onFalse', bundle, namespace);
    localizeNestedCommandArray(next, 'onTrue', bundle, namespace);
    localizeNestedCommandArray(next, 'body', bundle, namespace);

    if (Array.isArray(next.options)) {
        const options = next.options as unknown[];
        next.options = options.map((option): unknown => {
            if (!isRecord(option)) return option;
            const candidate = option;
            const localizedLabel = typeof candidate.labelId === 'string' && typeof candidate.label === 'string'
                ? resolveLocalizedText(bundle, candidate.labelId, {
                    fallback: candidate.label,
                    namespace,
                })
                : undefined;
            return {
                ...candidate,
                ...(localizedLabel === undefined ? {} : { label: localizedLabel }),
                ...(Array.isArray(candidate.commands)
                    ? { commands: candidate.commands.map((child) => localizeCommand(child as BaseCommand, bundle, namespace)) }
                    : {}),
            };
        });
    }

    return next;
}

function localizeNestedCommandArray(
    command: BaseCommand,
    key: 'body' | 'commands' | 'onFalse' | 'onTrue',
    bundle: LocaleBundle,
    namespace: string | undefined,
): void {
    const value = command[key];
    if (!Array.isArray(value)) return;
    command[key] = value.map((child) => localizeCommand(child as BaseCommand, bundle, namespace));
}

function toDefaultSceneNamespace(sceneName: string): string {
    return `scene.${sceneName}`;
}
