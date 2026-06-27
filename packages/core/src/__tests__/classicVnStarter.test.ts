import { describe, expect, it } from 'vitest';

import type { BaseCommand, DialogueBacklogEntry, TextLocalizationReference } from '../types';

import {
    CURRENT_CONTENT_SCHEMA_VERSION,
    EngineConfigSchema,
    GameManifestSchema,
    parseLocaleBundle,
    parseSceneFile,
} from '../schemas';
import { collectDialogueBacklogEntries } from '../utils/Backlog';
import {
    collectTextLocalizationReferences,
    validateLocalizationCoverage,
} from '../utils/Localization';
import { analyzeStoryGraph } from '../utils/StoryGraph';

const STARTER_PREFIX = '../../../../games/classic-vn-starter/';
const starterFiles: Record<string, unknown> = import.meta.glob('../../../../games/classic-vn-starter/**/*', {
    eager: true,
    import: 'default',
    query: '?raw',
});

describe('classic VN starter fixture', () => {
    it('uses v2 manifest/config/scene content and localization-ready line IDs', () => {
        const manifest = GameManifestSchema.parse(readJson('game.json'));
        const engineConfig = EngineConfigSchema.parse(readJson('engine.config.json'));
        const parsedLocaleBundle = parseLocaleBundle(readJson('locales/en.json'));

        expect(manifest.schemaVersion).toBe(CURRENT_CONTENT_SCHEMA_VERSION);
        expect(engineConfig.schemaVersion).toBe(CURRENT_CONTENT_SCHEMA_VERSION);
        expect(manifest.localization?.defaultLocale).toBe('en');
        expect(manifest.startScene).toBe('intro');
        expect(parsedLocaleBundle.success).toBe(true);
        if (!parsedLocaleBundle.success) {
            throw new Error(parsedLocaleBundle.error);
        }

        const sceneEntries = Object.entries(manifest.scenes ?? {});
        const allReferences: TextLocalizationReference[] = [];
        const allBacklogEntries: DialogueBacklogEntry[] = [];
        const scenes: Record<string, BaseCommand[]> = {};
        expect(sceneEntries).toHaveLength(3);

        for (const [sceneName, scenePath] of sceneEntries) {
            expect(typeof scenePath).toBe('string');
            if (typeof scenePath !== 'string') continue;

            const parsedScene = parseSceneFile(readJson(toProjectRelativePath(scenePath)), { sceneName });
            expect(parsedScene.schemaVersion).toBe(CURRENT_CONTENT_SCHEMA_VERSION);
            expect(parsedScene.metadata.id).toBe(sceneName);
            scenes[sceneName] = parsedScene.commands;

            const namespace = parsedScene.metadata.localeNamespace;
            expect(typeof namespace).toBe('string');
            if (typeof namespace !== 'string') continue;

            const references = collectTextLocalizationReferences(parsedScene.commands, { namespace });
            expect(references.length).toBeGreaterThan(0);
            allReferences.push(...references);
            allBacklogEntries.push(...collectDialogueBacklogEntries(parsedScene.commands, {
                namespace,
                sceneName,
            }));

            for (const choice of collectChoiceCommands(parsedScene.commands)) {
                expect(choice.id).toEqual(expect.any(String));
                expect(choice.options.length).toBeGreaterThan(0);
                for (const option of choice.options) {
                    expect(option.id).toEqual(expect.any(String));
                    expect(option.labelId).toEqual(expect.any(String));
                }
            }
        }

        const coverage = validateLocalizationCoverage(parsedLocaleBundle.data, allReferences);
        const graph = analyzeStoryGraph(scenes, { startScene: manifest.startScene });

        expect(coverage.missing).toEqual([]);
        expect(graph.issues).toEqual([]);
        expect(graph.reachableScenes).toEqual(['chapter_one', 'ending', 'intro']);
        expect(allBacklogEntries.length).toBe(allReferences.filter((reference) => reference.kind === 'dialogue').length);
        expect(allBacklogEntries.some((entry) => entry.tags.includes('backlog'))).toBe(true);
    });

    it('keeps starter asset references self-contained', () => {
        const manifest = GameManifestSchema.parse(readJson('game.json'));
        const characters = readJson<Record<string, unknown>>('data/characters.json');
        const items = readJson<Record<string, unknown>>('data/items.json');
        const macros = readJson<Record<string, BaseCommand[]>>('data/macros.json');
        const assetUrls = new Set<string>();

        collectAssetUrls(characters, assetUrls);
        collectAssetUrls(items, assetUrls);
        collectAssetUrls(macros, assetUrls);

        for (const scenePath of Object.values(manifest.scenes ?? {})) {
            if (typeof scenePath !== 'string') continue;
            const scene = parseSceneFile(readJson(toProjectRelativePath(scenePath)));
            collectAssetUrls(scene.commands, assetUrls);
        }

        expect(assetUrls.size).toBeGreaterThan(0);
        for (const assetUrl of assetUrls) {
            expect(hasStarterFile(toAssetPath(assetUrl)), assetUrl).toBe(true);
        }
    });
});

type ChoiceWithStableIds = {
    id?: string;
    options: Array<{
        commands?: BaseCommand[];
        id?: string;
        labelId?: string;
    }>;
    type: 'choice';
} & BaseCommand;

function collectAssetUrls(value: unknown, out: Set<string>): void {
    if (Array.isArray(value)) {
        for (const item of value) {
            collectAssetUrls(item, out);
        }
        return;
    }

    if (!isRecord(value)) return;

    const assetUrl = value.assetUrl;
    if (typeof assetUrl === 'string') {
        out.add(assetUrl);
    }

    const imageUrl = value.imageUrl;
    if (typeof imageUrl === 'string') {
        out.add(imageUrl);
    }

    const portraitUrl = value.portraitUrl;
    if (typeof portraitUrl === 'string') {
        out.add(portraitUrl);
    }

    for (const item of Object.values(value)) {
        collectAssetUrls(item, out);
    }
}

function collectChoiceCommands(commands: BaseCommand[]): ChoiceWithStableIds[] {
    const choices: ChoiceWithStableIds[] = [];
    visitCommands(commands, (command) => {
        if (command.type === 'choice') {
            choices.push(command as ChoiceWithStableIds);
        }
    });
    return choices;
}

function hasStarterFile(relativePath: string): boolean {
    return typeof starterFiles[toStarterFileKey(relativePath)] === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function readJson<T = unknown>(relativePath: string): T {
    const text = starterFiles[toStarterFileKey(relativePath)];
    if (typeof text !== 'string') {
        throw new TypeError(`Missing starter fixture file: ${relativePath}`);
    }
    return JSON.parse(text) as T;
}

function toAssetPath(assetUrl: string): string {
    const [pathOnly] = assetUrl.split(':');
    return toProjectRelativePath(pathOnly);
}

function toProjectRelativePath(projectPath: string): string {
    return projectPath.replace(/^\/+/, '');
}

function toStarterFileKey(relativePath: string): string {
    return `${STARTER_PREFIX}${relativePath}`;
}

function visitCommands(commands: BaseCommand[], visitor: (command: BaseCommand) => void): void {
    for (const command of commands) {
        visitor(command);

        if (command.type === 'choice') {
            for (const option of (command as ChoiceWithStableIds).options) {
                visitCommands(option.commands ?? [], visitor);
            }
        }

        if (command.type === 'if') {
            const ifCommand = command as {
                onFalse?: BaseCommand[];
                onTrue?: BaseCommand[];
            } & BaseCommand;
            visitCommands(ifCommand.onFalse ?? [], visitor);
            visitCommands(ifCommand.onTrue ?? [], visitor);
        }

        if (command.type === 'block') {
            visitCommands((command as { commands?: BaseCommand[] } & BaseCommand).commands ?? [], visitor);
        }
    }
}
