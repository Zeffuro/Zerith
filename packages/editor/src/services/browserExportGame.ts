import { zipSync } from 'fflate';

import type { ExportGameOptions, ExportGameResult } from './exportGame';

import { writeBrowserFolderExport } from './browserFolderExport';
import { browserFsAdapter } from './fs/browserFsAdapter';
import { prepareWebGameArtifacts } from './webGameArtifacts';

export async function exportGameForBrowser(
    gamePath: string,
    options: ExportGameOptions = {},
): Promise<ExportGameResult> {
    const { artifactManifest, files, playerFileCount, projectFiles } = await prepareWebGameArtifacts(gamePath, options);
    if (options.browserFolder) {
        const source = await browserFsAdapter.getDirectoryHandle(gamePath);
        const outDirectory = await writeBrowserFolderExport(options.browserFolder, files, source);
        return {
            artifactManifest,
            outDirectory,
            stderr: '',
            stdout: `Created browser folder export: ${outDirectory}\nIncluded ${projectFiles.length} project files and ${playerFileCount} player runtime files.`,
        };
    }
    const zipBytes = zipSync(files, { level: 9 });
    const zipBuffer = new ArrayBuffer(zipBytes.byteLength);
    new Uint8Array(zipBuffer).set(zipBytes);
    const downloadName = toDownloadFileName(options.zipFile, gamePath);

    if (options.download !== false) {
        downloadBlob(new Blob([zipBuffer], { type: 'application/zip' }), downloadName);
    }

    return {
        artifactManifest,
        stderr: options.zip === false
            ? 'Browser exports are downloaded as zip archives even when zip is disabled.\n'
            : '',
        stdout: [
            options.download === false
                ? `Prepared browser export artifact: ${downloadName}`
                : `Created browser export download: ${downloadName}`,
            `Included ${projectFiles.length} project files and ${playerFileCount} player runtime files.`,
            'Included compiled content manifest: zerith.content.json',
            `Compiled content cache: ${options.cachePolicy === 'none' ? 'disabled' : 'hashed local files'}`,
            `Base URL: ${options.base ?? './'}`,
        ].join('\n'),
    };
}

function basename(path: string): string {
    return path.split(/[\\/]/u).findLast(Boolean) ?? 'game';
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

function toDownloadFileName(zipFile: string | undefined, gamePath: string): string {
    const fileName = basename(zipFile?.trim() || `${basename(gamePath)}.zip`);
    const value = fileName.endsWith('.zip') ? fileName : `${fileName}.zip`;
    const printable = [...value].filter((character) => (character.codePointAt(0) ?? 0) >= 32).join('');
    return printable.replaceAll(/[<>:"/\\|?*]+/gu, '-').replaceAll(/^-|-$/gu, '') || 'game.zip';
}
