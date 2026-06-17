import { isTauriRuntime } from './runtime/runtimeEnvironment';

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
    if (!isTauriRuntime()) {
        const { exportGameForBrowser } = await import('./browserExportGame');
        return exportGameForBrowser(gamePath, options);
    }

    const request: ExportGameRequest = {
        base: options.base,
        gamePath,
        outDir: options.outDir,
        zip: options.zip,
        zipFile: options.zipFile,
    };

    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<ExportGameResult>('export_game', { request });
}

