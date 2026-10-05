import { fsJoin, fsMkdir, fsPickDirectory, fsReadBinaryFile, fsReadDirectory, fsWriteBinaryFileExclusive } from './fs';
import { assertProjectDestinationCurrent, type ProjectDestinationOptions, withProjectDestination } from './projectDestination';

export type SaveProjectAsOptions = ProjectDestinationOptions & {
    beforeCopy?: () => Promise<void>;
};

export type SaveProjectAsResult = {
    manifestPath: string;
    projectPath: string;
};

export async function saveProjectAs(
    currentProjectPath: string,
    options: SaveProjectAsOptions = {},
): Promise<SaveProjectAsResult | undefined> {
    const sourcePath = currentProjectPath.trim();
    if (!sourcePath) throw new Error('Current project path is required.');
    assertProjectDestinationCurrent(options);
    const targetPath = await fsPickDirectory('Save Project As — select an empty folder');
    if (!targetPath?.trim()) return;
    assertProjectDestinationCurrent(options);
    await options.beforeCopy?.();
    assertProjectDestinationCurrent(options);
    const entries = await collectProjectEntries(sourcePath, options);
    if (!entries.some(entry => entry.relativePath === 'game.json' && !entry.isDirectory)) {
        throw new Error('The source project has no game.json.');
    }

    return withProjectDestination(targetPath, { ...options, sourcePath }, async (projectPath, check) => {
        for (const entry of entries) {
            const target = await fsJoin(projectPath, ...entry.relativePath.split('/'));
            check();
            if (entry.isDirectory) {
                await fsMkdir(target, true);
            } else {
                const source = await fsJoin(sourcePath, ...entry.relativePath.split('/'));
                const content = await fsReadBinaryFile(source);
                check();
                await fsWriteBinaryFileExclusive(target, content);
            }
            check();
        }
        return { manifestPath: await fsJoin(projectPath, 'game.json'), projectPath };
    });
}

async function collectProjectEntries(
    sourcePath: string,
    options: ProjectDestinationOptions,
    prefix = '',
): Promise<Array<{ isDirectory: boolean; relativePath: string }>> {
    const entries = await fsReadDirectory(await fsJoin(sourcePath, prefix));
    assertProjectDestinationCurrent(options);
    const result: Array<{ isDirectory: boolean; relativePath: string }> = [];
    const names = new Set<string>();
    for (const entry of entries) {
        if (entry.isSymlink || (!entry.isDirectory && !entry.isFile)
            || !entry.name || /[/\\]/u.test(entry.name) || entry.name.includes('\u0000') || ['.', '..', '.zerith-project-reservation'].includes(entry.name)
            || names.has(entry.name.toLowerCase())) {
            throw new Error(`Cannot safely copy source entry: ${prefix}${entry.name}`);
        }
        names.add(entry.name.toLowerCase());
        const relativePath = `${prefix}${entry.name}`;
        result.push({ isDirectory: entry.isDirectory, relativePath });
        if (entry.isDirectory) result.push(...await collectProjectEntries(sourcePath, options, `${relativePath}/`));
    }
    return result;
}
