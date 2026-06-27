import type { BrowserDesktopExportArtifactManifest } from './browserParityReport';
import type { FsDirectoryEntry } from './fs/types';

import { createBrowserDesktopExportArtifactManifest } from './browserParityReport';
import { fsJoin, fsReadBinaryFile, fsReadDirectory } from './fs';

export type CollectExportArtifactManifestDependencies = {
    join: (...parts: string[]) => Promise<string>;
    readBinaryFile: (path: string) => Promise<Uint8Array>;
    readDirectory: (path: string) => Promise<readonly FsDirectoryEntry[]>;
};

export type CollectExportArtifactManifestOptions = {
    projectFiles?: readonly string[];
};

const COMPILED_CONTENT_PATH = 'zerith.content.json';

const DEFAULT_COLLECT_EXPORT_ARTIFACT_MANIFEST_DEPENDENCIES: CollectExportArtifactManifestDependencies = {
    join: fsJoin,
    readBinaryFile: fsReadBinaryFile,
    readDirectory: fsReadDirectory,
};

export async function collectExportArtifactManifest(
    rootPath: string,
    options: CollectExportArtifactManifestOptions = {},
    dependencies: CollectExportArtifactManifestDependencies = DEFAULT_COLLECT_EXPORT_ARTIFACT_MANIFEST_DEPENDENCIES,
): Promise<BrowserDesktopExportArtifactManifest> {
    const files: string[] = [];
    let compiledContentHash: string | undefined;

    const walk = async (directoryPath: string, relativeDirectory: string): Promise<void> => {
        const entries = await dependencies.readDirectory(directoryPath);

        for (const entry of entries) {
            if (entry.isSymlink) continue;

            const childPath = await dependencies.join(directoryPath, entry.name);
            const relativePath = joinArtifactPath(relativeDirectory, entry.name);

            if (entry.isDirectory) {
                await walk(childPath, relativePath);
                continue;
            }

            if (!entry.isFile) continue;

            files.push(relativePath);
            if (normalizeArtifactPath(relativePath) === COMPILED_CONTENT_PATH) {
                compiledContentHash = await sha256Hex(await dependencies.readBinaryFile(childPath));
            }
        }
    };

    await walk(rootPath, '');

    return createBrowserDesktopExportArtifactManifest(files, {
        ...(compiledContentHash === undefined ? {} : { fileHashes: { [COMPILED_CONTENT_PATH]: compiledContentHash } }),
        projectFiles: options.projectFiles,
    });
}

function joinArtifactPath(directory: string, name: string): string {
    return normalizeArtifactPath(directory ? `${directory}/${name}` : name);
}

function normalizeArtifactPath(path: string): string {
    return path.trim().replaceAll('\\', '/').replaceAll(/^\/+/gu, '');
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
    if (!globalThis.crypto?.subtle) {
        throw new Error('Export artifact hashing requires Web Crypto support.');
    }

    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}
