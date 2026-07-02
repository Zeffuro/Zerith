import type {
    DialogueBacklogEntry,
    GameManifest,
    LocaleBundle,
    LocaleEntryReference,
    SceneFile,
    Script,
    StoryGraphAnalysis,
    TextLocalizationReference,
} from '@zeffuro/zerith-core/types';

import { GameManifestSchema, parseLocaleBundle, parseSceneFile } from '@zeffuro/zerith-core/schemas';
import { collectDialogueBacklogEntries } from '@zeffuro/zerith-core/utils/Backlog';
import {
    collectTextLocalizationReferences,
    validateLocalizationCoverage,
} from '@zeffuro/zerith-core/utils/Localization';
import { analyzeStoryGraph } from '@zeffuro/zerith-core/utils/StoryGraph';

import { fsReadTextFile } from './fs';

export type ProjectValidationBacklogReport = {
    duplicateLineIds: Array<{
        entries: DialogueBacklogEntry[];
        lineId: string;
        namespace?: string;
    }>;
    entries: DialogueBacklogEntry[];
    hiddenCount: number;
    missingLineIds: DialogueBacklogEntry[];
    visibleCount: number;
    voicedCount: number;
};

export type ProjectValidationLocaleReport =
    | {
        bundle: LocaleBundle;
        locale: string;
        missing: ProjectValidationLocalizationReference[];
        path?: string;
        status: 'ok';
        unused: LocaleEntryReference[];
    }
    | {
        error: string;
        locale: string;
        path?: string;
        status: 'invalid';
    };

export type ProjectValidationLocalizationReference = {
    sceneName: string;
} & TextLocalizationReference;

export type ProjectValidationReport = {
    backlog: ProjectValidationBacklogReport;
    graph: StoryGraphAnalysis;
    localization: {
        defaultLocale?: string;
        localeReports: ProjectValidationLocaleReport[];
        referenceCount: number;
        references: ProjectValidationLocalizationReference[];
    };
    manifest: GameManifest;
    manifestPath: string;
    projectPath: string;
    scenes: ProjectValidationScene[];
};

export type ProjectValidationScene = {
    commands: Script;
    localeNamespace?: string;
    path?: string;
    sceneName: string;
};

type ProjectValidationDependencies = {
    readTextFile: (path: string) => Promise<string>;
};

const defaultDependencies: ProjectValidationDependencies = {
    readTextFile: fsReadTextFile,
};

export async function createProjectValidationReport(
    projectPath: string,
    dependencies: ProjectValidationDependencies = defaultDependencies,
): Promise<ProjectValidationReport> {
    const manifestPath = joinVirtualPath(projectPath, 'game.json');
    const manifest = await readManifest(manifestPath, dependencies);
    const scenes = await readScenes(projectPath, manifest.scenes ?? {}, dependencies);
    const sceneScripts = Object.fromEntries(
        scenes.map((scene) => [scene.sceneName, scene.commands]),
    );
    const graph = analyzeStoryGraph(sceneScripts, { startScene: manifest.startScene });
    const references = collectLocalizationReferences(scenes);
    const localeReports = await readLocaleReports(projectPath, manifest, references, dependencies);

    return {
        backlog: createBacklogReport(scenes),
        graph,
        localization: {
            defaultLocale: manifest.localization?.defaultLocale,
            localeReports,
            referenceCount: references.length,
            references,
        },
        manifest,
        manifestPath,
        projectPath,
        scenes,
    };
}

function collectDuplicateLineIds(entries: DialogueBacklogEntry[]): ProjectValidationBacklogReport['duplicateLineIds'] {
    const groups = new Map<string, DialogueBacklogEntry[]>();

    for (const entry of entries) {
        const lineId = entry.lineId?.trim();
        if (!lineId) continue;
        const key = `${entry.namespace ?? ''}:${lineId}`;
        const group = groups.get(key) ?? [];
        group.push(entry);
        groups.set(key, group);
    }

    return [...groups.values()]
        .filter((group) => group.length > 1)
        .map((entries) => ({
            entries,
            lineId: entries[0]?.lineId ?? '',
            namespace: entries[0]?.namespace,
        }))
        .toSorted((left, right) => (
            (left.namespace ?? '').localeCompare(right.namespace ?? '')
            || left.lineId.localeCompare(right.lineId)
        ));
}

function collectLocalizationReferences(scenes: ProjectValidationScene[]): ProjectValidationLocalizationReference[] {
    return scenes.flatMap((scene) => (
        collectTextLocalizationReferences(scene.commands, {
            namespace: scene.localeNamespace ?? toDefaultSceneNamespace(scene.sceneName),
        }).map((reference) => ({
            ...reference,
            sceneName: scene.sceneName,
        }))
    ));
}

function createBacklogReport(scenes: ProjectValidationScene[]): ProjectValidationBacklogReport {
    const entries = scenes.flatMap((scene) => collectDialogueBacklogEntries(scene.commands, {
        includeHidden: true,
        namespace: scene.localeNamespace ?? toDefaultSceneNamespace(scene.sceneName),
        sceneName: scene.sceneName,
    }));
    const hiddenCount = entries.filter((entry) => entry.backlogVisibility === 'hide').length;
    const missingLineIds = entries.filter((entry) => !entry.lineId?.trim());

    return {
        duplicateLineIds: collectDuplicateLineIds(entries),
        entries,
        hiddenCount,
        missingLineIds,
        visibleCount: entries.length - hiddenCount,
        voicedCount: entries.filter((entry) => entry.voice !== undefined).length,
    };
}

function isExternalPath(path: string): boolean {
    return /^(?:[a-z]+:)?\/\//iu.test(path) || path.startsWith('data:');
}

function joinVirtualPath(directoryPath: string, name: string): string {
    return `${directoryPath.replaceAll(/\/+$/gu, '')}/${name}`;
}

async function readJson<T>(path: string, dependencies: ProjectValidationDependencies): Promise<T> {
    return JSON.parse(await dependencies.readTextFile(path)) as T;
}

async function readLocaleReports(
    projectPath: string,
    manifest: GameManifest,
    references: ProjectValidationLocalizationReference[],
    dependencies: ProjectValidationDependencies,
): Promise<ProjectValidationLocaleReport[]> {
    const locales = manifest.localization?.locales ?? {};
    const reports = await Promise.all(Object.entries(locales).map(async ([locale, value]) => {
        const localePath = typeof value === 'string'
            ? resolveProjectFilePath(projectPath, value)
            : undefined;
        const candidate = localePath
            ? await readJson<unknown>(localePath, dependencies)
            : value;
        const parsed = parseLocaleBundle(candidate);

        if (!parsed.success) {
            return {
                error: parsed.error,
                locale,
                path: localePath,
                status: 'invalid',
            } satisfies ProjectValidationLocaleReport;
        }

        const coverage = validateLocalizationCoverage(parsed.data, references);
        return {
            bundle: parsed.data,
            locale,
            missing: coverage.missing as ProjectValidationLocalizationReference[],
            path: localePath,
            status: 'ok',
            unused: coverage.unused,
        } satisfies ProjectValidationLocaleReport;
    }));

    return reports.toSorted((left, right) => left.locale.localeCompare(right.locale));
}

async function readManifest(
    manifestPath: string,
    dependencies: ProjectValidationDependencies,
): Promise<GameManifest> {
    const parsed = GameManifestSchema.safeParse(await readJson<unknown>(manifestPath, dependencies));
    if (parsed.success) return parsed.data as GameManifest;

    const firstIssue = parsed.error.issues[0];
    const message = firstIssue
        ? `${firstIssue.path.join('.') || 'manifest'}: ${firstIssue.message}`
        : 'Invalid manifest.';
    throw new TypeError(`Project validation could not read ${manifestPath}: ${message}`);
}

async function readScenes(
    projectPath: string,
    scenes: NonNullable<GameManifest['scenes']>,
    dependencies: ProjectValidationDependencies,
): Promise<ProjectValidationScene[]> {
    const entries = await Promise.all(Object.entries(scenes).map(async ([sceneName, scene]) => {
        const path = typeof scene === 'string'
            ? resolveProjectFilePath(projectPath, scene)
            : undefined;
        const sceneFile = path
            ? await readJson<SceneFile | Script>(path, dependencies)
            : scene;
        const parsed = parseSceneFile(sceneFile, { sceneName });

        return {
            commands: parsed.commands,
            localeNamespace: typeof parsed.metadata.localeNamespace === 'string'
                ? parsed.metadata.localeNamespace
                : undefined,
            path,
            sceneName,
        };
    }));

    return entries.toSorted((left, right) => left.sceneName.localeCompare(right.sceneName));
}

function resolveProjectFilePath(projectPath: string, assetPath: string): string {
    if (isExternalPath(assetPath)) return assetPath;
    return assetPath.startsWith('/')
        ? joinVirtualPath(projectPath, assetPath.slice(1))
        : joinVirtualPath(projectPath, assetPath);
}

function toDefaultSceneNamespace(sceneName: string): string {
    return `scene.${sceneName}`;
}
