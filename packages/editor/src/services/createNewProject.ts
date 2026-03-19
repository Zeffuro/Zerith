import { fsJoin, fsMkdir, fsWriteTextFile } from './fs';

export type NewProjectOptions = {
    author: string;
    directory: string;
    name: string;
};

export type NewProjectScaffoldResult = {
    manifestPath: string;
    projectPath: string;
};

export async function createNewProject(options: NewProjectOptions): Promise<NewProjectScaffoldResult> {
    const projectPath = options.directory.trim();
    const projectName = options.name.trim();
    const projectAuthor = options.author.trim();

    if (!projectPath) {
        throw new TypeError('Project directory is required.');
    }

    if (!projectName) {
        throw new TypeError('Project name is required.');
    }

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
        startScene: 'intro',
        title: projectName,
    };

    const engineConfig = {
        $schema: 'zerith/engine-config',
        display: {
            height: 720,
            scaleMode: 'fit',
            width: 1280,
        },
        theme: {
            boxColor: 51,
            fontFamily: 'Comic',
            fontSize: 24,
        },
    };

    await fsWriteTextFile(manifestPath, `${JSON.stringify(manifest, undefined, 4)}\n`);
    await fsWriteTextFile(introScenePath, `${JSON.stringify([], undefined, 4)}\n`);
    await fsWriteTextFile(engineConfigPath, `${JSON.stringify(engineConfig, undefined, 4)}\n`);

    return {
        manifestPath,
        projectPath,
    };
}

