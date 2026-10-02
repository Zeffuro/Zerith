import type { FsTextWriteOptions } from './fs';

import { fsReadTextFile, fsWriteTextFile } from './fs';

const defaultWriteDependencies = { readTextFile: fsReadTextFile, writeTextFile: fsWriteTextFile };

export type FileWriteBatchResult = {
    committed: string[];
    pending: string[];
};

export type TextFileWrite = {
    content: string;
    expectedContent?: string;
    filePath: string;
};

export class FileWriteBatchError extends Error {
    constructor(public readonly result: FileWriteBatchResult, public readonly failedPath: string, reason: unknown) {
        const detail = reason instanceof Error ? reason.message : (typeof reason === 'object' && reason !== null && 'message' in reason ? String(reason.message) : String(reason));
        super(`Could not save ${failedPath}: ${detail} ${result.committed.length} file(s) saved, ${result.pending.length} remaining.`);
        this.name = 'FileWriteBatchError';
    }
}

export async function writeTextFileBatch(
    files: readonly TextFileWrite[],
    dependencies: {
        readTextFile?: (path: string) => Promise<string>;
        writeTextFile: (path: string, content: string, options?: FsTextWriteOptions) => Promise<void>;
    } = defaultWriteDependencies,
): Promise<FileWriteBatchResult> {
    const committed: string[] = [];
    for (const file of files) {
        if (file.expectedContent === undefined || !dependencies.readTextFile) continue;
        try {
            if (await dependencies.readTextFile(file.filePath) !== file.expectedContent) throw new Error('File changed on disk. Review the operation again.');
        } catch (error) {
            throw new FileWriteBatchError({ committed, pending: files.map((entry) => entry.filePath) }, file.filePath, error);
        }
    }
    for (const [index, file] of files.entries()) {
        try {
            await (file.expectedContent === undefined ? dependencies.writeTextFile(file.filePath, file.content) : dependencies.writeTextFile(file.filePath, file.content, { expectedContent: file.expectedContent }));
            committed.push(file.filePath);
        } catch (error) {
            throw new FileWriteBatchError({ committed, pending: files.slice(index).map((entry) => entry.filePath) }, file.filePath, error);
        }
    }
    return { committed, pending: [] };
}
