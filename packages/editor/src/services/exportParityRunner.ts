import type { ExportGameOptions, ExportGameResult } from './exportGame';
import type { BrowserDesktopExportRunSmokeComparison } from './exportParitySmoke';

import { exportGame, resolveExportGameOptions } from './exportGame';
import { compareBrowserDesktopExportRuns } from './exportParitySmoke';
import { isTauriRuntime } from './runtime/runtimeEnvironment';

export type BrowserDesktopExportSmokeRunDependencies = {
    runBrowserExport: (gamePath: string, options: ExportGameOptions) => Promise<ExportGameResult>;
    runDesktopExport: (gamePath: string, options: ExportGameOptions) => Promise<ExportGameResult>;
};

export type BrowserDesktopExportSmokeRunReport = {
    browserResult: ExportGameResult;
    comparison: BrowserDesktopExportRunSmokeComparison;
    desktopResult: ExportGameResult;
    options: ExportGameOptions;
};

export async function runBrowserDesktopExportSmoke(
    gamePath: string,
    options: ExportGameOptions = {},
    dependencies: Partial<BrowserDesktopExportSmokeRunDependencies> = {},
): Promise<BrowserDesktopExportSmokeRunReport> {
    const resolvedOptions = resolveExportGameOptions({
        ...options,
        profile: options.profile ?? 'local-preview',
    });
    const runBrowserExport = dependencies.runBrowserExport ?? runBrowserExportWithoutDownload;
    const runDesktopExport = dependencies.runDesktopExport ?? runDesktopExportFromDesktopRuntime;

    const browserResult = await runBrowserExport(gamePath, {
        ...resolvedOptions,
        download: false,
    });
    const desktopResult = await runDesktopExport(gamePath, resolvedOptions);
    const comparison = compareBrowserDesktopExportRuns(browserResult, desktopResult);

    return {
        browserResult,
        comparison,
        desktopResult,
        options: resolvedOptions,
    };
}

async function runBrowserExportWithoutDownload(
    gamePath: string,
    options: ExportGameOptions,
): Promise<ExportGameResult> {
    const { exportGameForBrowser } = await import('./browserExportGame');
    return exportGameForBrowser(gamePath, {
        ...options,
        download: false,
    });
}

async function runDesktopExportFromDesktopRuntime(
    gamePath: string,
    options: ExportGameOptions,
): Promise<ExportGameResult> {
    if (!isTauriRuntime()) {
        throw new Error('Browser/desktop export smoke requires the desktop editor runtime.');
    }

    return exportGame(gamePath, options);
}
