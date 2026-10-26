import type { GameManifest } from '@zeffuro/zerith-core/types';

import {
    CURRENT_CONTENT_SCHEMA_VERSION,
    migrateSceneFileToCurrent,
} from '@zeffuro/zerith-core/schemas';

import { isRecord } from '../utils/typeGuards';
import { fsReadTextFile, fsWriteTextFile } from './fs';

export type ApplyContentMigrationPreviewDependencies = {
    readTextFile: (path: string) => Promise<string>;
    writeTextFile: typeof fsWriteTextFile;
};

export type ApplyContentMigrationPreviewOptions = {
    acceptedPaths?: string[];
    isCurrent?: () => boolean;
};

export type ApplyContentMigrationPreviewResult = {
    conflicts: ContentMigrationPreviewChange[];
    failures?: { change: ContentMigrationPreviewChange; message: string }[];
    retired?: boolean;
    skipped: ContentMigrationPreviewChange[];
    written: ContentMigrationPreviewChange[];
};

export type ContentMigrationPreviewChange = {
    after: string;
    before: string;
    path: string;
    sceneName?: string;
    type: 'manifest' | 'scene';
};

export type ContentMigrationPreviewDependencies = {
    readTextFile: (path: string) => Promise<string>;
};

export type ContentMigrationPreviewResult = {
    changes: ContentMigrationPreviewChange[];
    manifestPath: string;
    projectPath: string;
};

export type RunContentMigrationDependencies = ApplyContentMigrationPreviewDependencies;

export type RunContentMigrationOptions = {
    apply?: boolean;
} & ApplyContentMigrationPreviewOptions;

export type RunContentMigrationResult = {
    application?: ApplyContentMigrationPreviewResult;
    preview: ContentMigrationPreviewResult;
    status: 'applied' | 'preview';
};

const defaultDependencies: ContentMigrationPreviewDependencies = {
    readTextFile: fsReadTextFile,
};

const defaultApplyDependencies: ApplyContentMigrationPreviewDependencies = {
    readTextFile: fsReadTextFile,
    writeTextFile: fsWriteTextFile,
};

type ManifestScenes = NonNullable<GameManifest['scenes']>;

export async function applyContentMigrationPreview(
    preview: ContentMigrationPreviewResult,
    options: ApplyContentMigrationPreviewOptions = {},
    dependencies: ApplyContentMigrationPreviewDependencies = defaultApplyDependencies,
): Promise<ApplyContentMigrationPreviewResult> {
    const acceptedPaths = options.acceptedPaths
        ? new Set(options.acceptedPaths.map((path) => normalizeSlashes(path)))
        : undefined;
    const conflicts: ContentMigrationPreviewChange[] = [];
    const skipped: ContentMigrationPreviewChange[] = [];
    const written: ContentMigrationPreviewChange[] = [];
    const failures: NonNullable<ApplyContentMigrationPreviewResult['failures']> = [];
    const isCurrent = options.isCurrent ?? (() => true);
    const result = (): ApplyContentMigrationPreviewResult => ({
        conflicts, skipped, written,
        ...(failures.length > 0 ? { failures } : {}),
        ...(isCurrent() ? {} : { retired: true }),
    });

    for (const [index, change] of preview.changes.entries()) {
        if (!isCurrent()) {
            skipped.push(...preview.changes.slice(index));
            break;
        }
        if (acceptedPaths && !acceptedPaths.has(normalizeSlashes(change.path))) {
            skipped.push(change);
            continue;
        }

        try {
            const currentText = await dependencies.readTextFile(change.path);
            if (!isCurrent()) {
                skipped.push(...preview.changes.slice(index));
                break;
            }
            if (currentText !== change.before) {
                conflicts.push(change);
                continue;
            }
            await dependencies.writeTextFile(change.path, change.after, { expectedContent: change.before }, isCurrent);
            written.push(change);
        } catch (error) {
            if (!isCurrent()) {
                skipped.push(...preview.changes.slice(index));
                break;
            }
            const message = formatMigrationError(error);
            if ((isRecord(error) && error.code === 'stale') || message.includes('File changed on disk')) {
                conflicts.push(change);
                continue;
            }
            failures.push({ change, message });
            skipped.push(...preview.changes.slice(index + 1));
            break;
        }
    }

    return result();
}

export async function previewContentMigration(
    projectPath: string,
    dependencies: ContentMigrationPreviewDependencies = defaultDependencies,
): Promise<ContentMigrationPreviewResult> {
    const normalizedProjectPath = normalizeProjectPath(projectPath);
    const manifestPath = resolveProjectPath(normalizedProjectPath, 'game.json');
    const manifestText = await dependencies.readTextFile(manifestPath);
    const manifest = parseJsonObject(manifestText, manifestPath) as GameManifest;
    const changes: ContentMigrationPreviewChange[] = [];
    const nextManifest = {
        ...manifest,
        schemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
    };

    if (isRecord(manifest.scenes)) {
        const sceneMigration = await previewSceneMigrations(
            normalizedProjectPath,
            manifest.scenes,
            dependencies,
        );

        if (sceneMigration.inlineScenesChanged) {
            nextManifest.scenes = sceneMigration.nextManifestScenes;
        }

        changes.push(...sceneMigration.changes);
    }

    const nextManifestText = formatJson(nextManifest);
    if (nextManifestText !== normalizeJsonText(manifestText)) {
        changes.unshift({
            after: nextManifestText,
            before: manifestText,
            path: manifestPath,
            type: 'manifest',
        });
    }

    return {
        changes,
        manifestPath,
        projectPath: normalizedProjectPath,
    };
}

export async function runContentMigration(
    projectPath: string,
    options: RunContentMigrationOptions = {},
    dependencies: RunContentMigrationDependencies = defaultApplyDependencies,
): Promise<RunContentMigrationResult> {
    const preview = await previewContentMigration(projectPath, dependencies);

    if (!options.apply) {
        return {
            preview,
            status: 'preview',
        };
    }

    const application = await applyContentMigrationPreview(preview, options, dependencies);

    return {
        application,
        preview,
        status: 'applied',
    };
}

function formatJson(value: unknown): string {
    return `${JSON.stringify(value, undefined, 4)}\n`;
}

function formatMigrationError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (isRecord(error) && typeof error.message === 'string') return error.message;
    return String(error);
}

function normalizeJsonText(text: string): string {
    return formatJson(JSON.parse(text) as unknown);
}

function normalizeProjectPath(path: string): string {
    const normalized = normalizeSlashes(path).replace(/\/+$/u, '');
    if (!normalized) {
        throw new TypeError('Project path is required.');
    }

    return normalized;
}

function normalizeSlashes(path: string): string {
    return path.replaceAll('\\', '/');
}

function parseJsonObject(text: string, path: string): Record<string, unknown> {
    const parsed = JSON.parse(text) as unknown;
    if (!isRecord(parsed)) {
        throw new TypeError(`Expected ${path} to contain a JSON object.`);
    }

    return parsed;
}

async function previewSceneMigrations(
    projectPath: string,
    scenes: Record<string, unknown>,
    dependencies: ContentMigrationPreviewDependencies,
): Promise<{
    changes: ContentMigrationPreviewChange[];
    inlineScenesChanged: boolean;
    nextManifestScenes: ManifestScenes;
}> {
    const changes: ContentMigrationPreviewChange[] = [];
    const nextManifestScenes = { ...scenes } as ManifestScenes;
    let inlineScenesChanged = false;

    for (const [sceneName, sceneSource] of Object.entries(scenes)) {
        if (typeof sceneSource === 'string') {
            const path = resolveProjectPath(projectPath, sceneSource);
            const before = await dependencies.readTextFile(path);
            const scene = JSON.parse(before) as unknown;
            const migrated = migrateSceneFileToCurrent(scene, { sceneId: sceneName });
            const after = formatJson(migrated.scene);

            if (after !== normalizeJsonText(before)) {
                changes.push({
                    after,
                    before,
                    path,
                    sceneName,
                    type: 'scene',
                });
            }

            continue;
        }

        if (Array.isArray(sceneSource) || isRecord(sceneSource)) {
            const migrated = migrateSceneFileToCurrent(sceneSource, { sceneId: sceneName });
            if (migrated.changed) {
                nextManifestScenes[sceneName] = migrated.scene;
                inlineScenesChanged = true;
            }
        }
    }

    return {
        changes,
        inlineScenesChanged,
        nextManifestScenes,
    };
}

function resolveProjectPath(projectPath: string, manifestPath: string): string {
    const normalizedPath = normalizeSlashes(manifestPath);
    if (normalizedPath.startsWith('/')) {
        return `${projectPath}${normalizedPath}`;
    }

    return `${projectPath}/${normalizedPath}`;
}
