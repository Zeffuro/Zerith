import { CURRENT_CONTENT_SCHEMA_VERSION } from 'core/schemas';

import { fsJoin, fsMkdir, fsWriteTextFile } from './fs';

export type NewProjectOptions = {
    author: string;
    directory: string;
    name: string;
    templateId?: string;
};

export type NewProjectScaffoldResult = {
    initialEntryPath: string;
    manifestPath: string;
    onboardingChecks: readonly NewProjectTemplateReadinessCheck[];
    projectPath: string;
    templateId: NewProjectTemplateId;
};

export type NewProjectTemplateDefinition = {
    category: 'starter' | 'utility';
    defaultName: string;
    description: string;
    id: NewProjectTemplateId;
    initialEntry: string;
    label: string;
    readinessChecks: readonly NewProjectTemplateReadinessCheck[];
    summary: string;
    tags: readonly string[];
};

export type NewProjectTemplateId = 'blank' | 'classic-vn';

export type NewProjectTemplateReadinessCheck = {
    description: string;
    id: string;
    label: string;
};

export const NEW_PROJECT_TEMPLATES: readonly NewProjectTemplateDefinition[] = [
    {
        category: 'utility',
        defaultName: 'My New Game',
        description: 'Empty v2 manifest, intro scene, and engine config.',
        id: 'blank',
        initialEntry: '/scenes/intro.json',
        label: 'Blank',
        readinessChecks: [
            {
                description: 'Uses the current v2 scene envelope with an empty intro scene.',
                id: 'v2-scene',
                label: 'Schema-ready',
            },
            {
                description: 'Disables the missing default blip so preview starts quietly.',
                id: 'audio-default',
                label: 'Audio-safe',
            },
        ],
        summary: 'Minimal project for custom setups.',
        tags: ['v2', 'empty', 'custom'],
    },
    {
        category: 'starter',
        defaultName: 'Classic VN Starter',
        description: 'Classic VN sample with scenes, characters, localization, and SVG placeholder assets.',
        id: 'classic-vn',
        initialEntry: '/scenes/intro.json',
        label: 'Classic VN',
        readinessChecks: [
            {
                description: 'Includes stable dialogue line IDs and a matching locale bundle.',
                id: 'line-ids',
                label: 'Localization-ready',
            },
            {
                description: 'Includes graph metadata, labels, jumps, and a validation-clean route.',
                id: 'branching',
                label: 'Branch-ready',
            },
            {
                description: 'Includes SVG placeholder backgrounds, sprites, and item assets.',
                id: 'assets',
                label: 'Asset-ready',
            },
        ],
        summary: 'Recommended VN-first starter.',
        tags: ['recommended', 'localization', 'branching'],
    },
] as const;

const TEMPLATE_BY_ID = new Map<string, NewProjectTemplateDefinition>(
    NEW_PROJECT_TEMPLATES.map((template) => [template.id, template]),
);

export function getNewProjectTemplate(templateId = 'blank'): NewProjectTemplateDefinition {
    const template = TEMPLATE_BY_ID.get(templateId);

    if (!template) {
        throw new TypeError(`Unknown project template: ${templateId}`);
    }

    return template;
}

export function getNewProjectTemplateDefaultName(templateId: string | undefined): string {
    return getNewProjectTemplate(templateId).defaultName;
}

export function isNewProjectTemplateId(value: string): value is NewProjectTemplateId {
    return TEMPLATE_BY_ID.has(value);
}

const CLASSIC_VN_STARTER_FILES = import.meta.glob<string>(
    '../../../../games/classic-vn-starter/**/*',
    {
        eager: true,
        import: 'default',
        query: '?raw',
    },
);
const DISABLED_DEFAULT_BLIP_URL = JSON.parse('null') as null;

export async function createNewProject(options: NewProjectOptions): Promise<NewProjectScaffoldResult> {
    const projectPath = options.directory.trim();
    const projectName = options.name.trim();
    const projectAuthor = options.author.trim();
    const template = getNewProjectTemplate(options.templateId);

    if (!projectPath) {
        throw new TypeError('Project directory is required.');
    }

    if (!projectName) {
        throw new TypeError('Project name is required.');
    }

    if (template.id === 'classic-vn') {
        await createClassicVnProject({
            projectAuthor,
            projectName,
            projectPath,
        });
        return {
            initialEntryPath: await resolveTemplateInitialEntryPath(projectPath, template),
            manifestPath: await fsJoin(projectPath, 'game.json'),
            onboardingChecks: template.readinessChecks,
            projectPath,
            templateId: template.id,
        };
    }

    await createBlankProject({
        projectAuthor,
        projectName,
        projectPath,
    });

    return {
        initialEntryPath: await resolveTemplateInitialEntryPath(projectPath, template),
        manifestPath: await fsJoin(projectPath, 'game.json'),
        onboardingChecks: template.readinessChecks,
        projectPath,
        templateId: template.id,
    };
}

function applyManifestIdentity(rawManifest: string, projectName: string, projectAuthor: string): string {
    const manifest = JSON.parse(rawManifest) as Record<string, unknown>;
    manifest.title = projectName;

    if (projectAuthor) {
        manifest.author = projectAuthor;
    } else {
        delete manifest.author;
    }

    return `${JSON.stringify(manifest, undefined, 4)}\n`;
}

async function createBlankProject(options: {
    projectAuthor: string;
    projectName: string;
    projectPath: string;
}): Promise<void> {
    const { projectAuthor, projectName, projectPath } = options;
    const scenesPath = await fsJoin(projectPath, 'scenes');
    const manifestPath = await fsJoin(projectPath, 'game.json');
    const introScenePath = await fsJoin(scenesPath, 'intro.json');
    const engineConfigPath = await fsJoin(projectPath, 'engine.config.json');

    await fsMkdir(projectPath, true);
    await fsMkdir(scenesPath, true);

    const manifest = {
        $schema: 'zerith/manifest',
        ...(projectAuthor ? { author: projectAuthor } : {}),
        scenes: {
            intro: '/scenes/intro.json',
        },
        schemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
        startScene: 'intro',
        title: projectName,
    };

    const engineConfig = {
        $schema: 'zerith/engine-config',
        audio: {
            defaultBlipUrl: DISABLED_DEFAULT_BLIP_URL,
        },
        display: {
            height: 720,
            scaleMode: 'fit',
            width: 1280,
        },
        schemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
        theme: {
            boxColor: 51,
            fontFamily: 'Comic',
            fontSize: 24,
        },
    };

    const introScene = {
        $schema: 'zerith/scene',
        commands: [],
        id: 'intro',
        localeNamespace: 'scene.intro',
        schemaVersion: CURRENT_CONTENT_SCHEMA_VERSION,
    };

    await fsWriteTextFile(manifestPath, `${JSON.stringify(manifest, undefined, 4)}\n`);
    await fsWriteTextFile(introScenePath, `${JSON.stringify(introScene, undefined, 4)}\n`);
    await fsWriteTextFile(engineConfigPath, `${JSON.stringify(engineConfig, undefined, 4)}\n`);
}

async function createClassicVnProject(options: {
    projectAuthor: string;
    projectName: string;
    projectPath: string;
}): Promise<void> {
    const { projectAuthor, projectName, projectPath } = options;
    const templateEntries = getClassicVnStarterTemplateEntries();

    if (templateEntries.length === 0) {
        throw new Error('Classic VN starter template files are missing.');
    }

    await fsMkdir(projectPath, true);

    const createdDirectories = new Set<string>();
    for (const [relativePath, rawContents] of templateEntries) {
        const targetPath = await fsJoin(projectPath, ...relativePath.split('/'));
        const directoryPath = await getDirectoryPath(projectPath, relativePath);

        if (!createdDirectories.has(directoryPath)) {
            await fsMkdir(directoryPath, true);
            createdDirectories.add(directoryPath);
        }

        const contents = relativePath === 'game.json'
            ? applyManifestIdentity(rawContents, projectName, projectAuthor)
            : normalizeTextFile(rawContents);
        await fsWriteTextFile(targetPath, contents);
    }
}

function getClassicVnStarterTemplateEntries(): Array<[string, string]> {
    return Object.entries(CLASSIC_VN_STARTER_FILES)
        .map(([path, contents]) => [toClassicVnStarterRelativePath(path), contents] as const)
        .filter((entry): entry is [string, string] => Boolean(entry[0]) && typeof entry[1] === 'string')
        .toSorted(([left], [right]) => left.localeCompare(right));
}

async function getDirectoryPath(projectPath: string, relativePath: string): Promise<string> {
    const directoryParts = relativePath.split('/').slice(0, -1);
    return directoryParts.length === 0
        ? projectPath
        : await fsJoin(projectPath, ...directoryParts);
}

function normalizeTextFile(value: string): string {
    return value.endsWith('\n') ? value : `${value}\n`;
}

async function resolveTemplateInitialEntryPath(
    projectPath: string,
    template: NewProjectTemplateDefinition,
): Promise<string> {
    return fsJoin(projectPath, ...template.initialEntry.replaceAll(/^\/+/gu, '').split('/'));
}

function toClassicVnStarterRelativePath(path: string): string | undefined {
    const normalizedPath = path.replaceAll('\\', '/');
    const marker = '/classic-vn-starter/';
    const markerIndex = normalizedPath.indexOf(marker);
    if (markerIndex === -1) {
        return undefined;
    }

    return normalizedPath.slice(markerIndex + marker.length);
}
