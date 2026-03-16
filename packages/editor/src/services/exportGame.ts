import { invoke } from '@tauri-apps/api/core';

export type ExportGameOptions = {
    base?: string;
    outDir?: string;
    zip?: boolean;
    zipFile?: string;
};

export type ExportGameResult = {
    stderr: string;
    stdout: string;
};

type ExportGameRequest = {
    base?: string;
    gamePath: string;
    outDir?: string;
    zip?: boolean;
    zipFile?: string;
};

export async function exportGame(gamePath: string, options: ExportGameOptions = {}): Promise<ExportGameResult> {
    const request: ExportGameRequest = {
        base: options.base,
        gamePath,
        outDir: options.outDir,
        zip: options.zip,
        zipFile: options.zipFile,
    };

    return invoke<ExportGameResult>('export_game', { request });
}

