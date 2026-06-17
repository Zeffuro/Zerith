import type { Zippable } from 'fflate';

import { strToU8, zipSync } from 'fflate';

import type { ExportGameOptions, ExportGameResult } from './exportGame';

import { fsReadBinaryFile, fsReadDirectory } from './fs';

const PLAYER_TEMPLATE_FILES = import.meta.glob<string>(
    '../../../player/dist/{index.html,assets/*.js}',
    {
        eager: true,
        import: 'default',
        query: '?raw',
    },
);

export async function exportGameForBrowser(
    gamePath: string,
    options: ExportGameOptions = {},
): Promise<ExportGameResult> {
    const zipEntries: Zippable = {};
    const playerFileCount = addPlayerTemplateFiles(zipEntries);
    const projectFileCount = await addProjectFiles(zipEntries, gamePath);
    const zipBytes = zipSync(zipEntries, { level: 9 });
    const zipBuffer = zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength);
    const downloadName = toDownloadFileName(options.zipFile, gamePath);

    downloadBlob(new Blob([zipBuffer], { type: 'application/zip' }), downloadName);

    return {
        stderr: options.zip === false
            ? 'Browser exports are downloaded as zip archives even when zip is disabled.\n'
            : '',
        stdout: [
            `Created browser export download: ${downloadName}`,
            `Included ${projectFileCount} project files and ${playerFileCount} player runtime files.`,
            `Base URL: ${options.base ?? './'}`,
        ].join('\n'),
    };
}

function addPlayerTemplateFiles(zipEntries: Zippable): number {
    const templateEntries = Object.entries(PLAYER_TEMPLATE_FILES);
    if (templateEntries.length === 0) {
        throw new Error('Browser player template is missing. Run the player build before building the editor.');
    }

    let fileCount = 0;
    for (const [sourcePath, contents] of templateEntries) {
        const zipPath = toPlayerTemplateZipPath(sourcePath);
        zipEntries[zipPath] = strToU8(zipPath === 'index.html' ? rewritePlayerIndex(contents) : contents);
        fileCount += 1;
    }

    return fileCount;
}

async function addProjectFiles(zipEntries: Zippable, gamePath: string): Promise<number> {
    let fileCount = 0;

    const walk = async (directoryPath: string) => {
        const entries = await fsReadDirectory(directoryPath);

        for (const entry of entries) {
            const path = joinVirtualPath(directoryPath, entry.name);
            if (entry.isDirectory) {
                await walk(path);
                continue;
            }

            if (!entry.isFile) continue;

            const zipPath = toProjectZipPath(gamePath, path);
            if (zipEntries[zipPath]) continue;

            zipEntries[zipPath] = await fsReadBinaryFile(path);
            fileCount += 1;
        }
    };

    await walk(gamePath);
    return fileCount;
}

function basename(path: string): string {
    return path.split(/[\\/]/).findLast((segment) => segment.length > 0) ?? 'game';
}

function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.style.display = 'none';
    document.body.append(link);
    link.click();
    link.remove();
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function joinVirtualPath(directoryPath: string, name: string): string {
    return `${directoryPath.replaceAll(/\/+$/gu, '')}/${name}`;
}

function rewritePlayerIndex(contents: string): string {
    return contents.replaceAll('./assets/', './zerith-player/');
}

function sanitizeFileName(value: string): string {
    const withoutControlCharacters = [...value]
        .filter((character) => (character.codePointAt(0) ?? 0) >= 32)
        .join('');
    return withoutControlCharacters.replaceAll(/[<>:"/\\|?*]+/gu, '-').replaceAll(/^-|-$/gu, '') || 'game';
}

function toDownloadFileName(zipFile: string | undefined, gamePath: string): string {
    const fileName = basename(zipFile?.trim() || `${basename(gamePath)}.zip`);
    return sanitizeFileName(fileName.endsWith('.zip') ? fileName : `${fileName}.zip`);
}

function toPlayerTemplateZipPath(sourcePath: string): string {
    const normalizedPath = sourcePath.replaceAll('\\', '/');
    const relativePath = normalizedPath.slice(normalizedPath.lastIndexOf('/dist/') + '/dist/'.length);
    if (relativePath === 'index.html') return 'index.html';
    return relativePath.replace(/^assets\//u, 'zerith-player/');
}

function toProjectZipPath(rootPath: string, filePath: string): string {
    const normalizedRoot = rootPath.replaceAll('\\', '/').replaceAll(/\/+$/gu, '');
    const normalizedFile = filePath.replaceAll('\\', '/');
    const relativePath = normalizedFile.startsWith(`${normalizedRoot}/`)
        ? normalizedFile.slice(normalizedRoot.length + 1)
        : normalizedFile;
    return relativePath.replaceAll(/^\/+/gu, '');
}
