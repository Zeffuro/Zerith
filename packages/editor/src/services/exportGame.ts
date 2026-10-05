import type { BrowserFolderExportTarget } from './browserFolderExport';
import type { BrowserDesktopExportArtifactManifest } from './browserParityReport';

import { isTauriRuntime } from './runtime/runtimeEnvironment';

export type ExportCachePolicy = 'hashed' | 'none';

export type ExportGameOptions = {
    base?: string;
    browserFolder?: BrowserFolderExportTarget;
    cachePolicy?: ExportCachePolicy;
    download?: boolean;
    outDir?: string;
    profile?: ExportProfile;
    zip?: boolean;
    zipFile?: string;
};

export type ExportGameResult = {
    artifactManifest?: BrowserDesktopExportArtifactManifest;
    executablePath?: string;
    outDirectory?: string;
    stderr: string;
    stdout: string;
    zipPath?: string;
};

export type ExportProfile = 'desktop-tauri' | 'generic-web' | 'itch-html5' | 'local-preview';

export type ExportProfileCatalogEntry = {
    description: string;
    id: ExportProfileCatalogId;
    label: string;
    selectable: boolean;
    status: 'planned' | 'supported';
    target: 'desktop' | 'web';
};

export type ExportProfileCatalogId = 'desktop-tauri' | 'github-pages-dual' | ExportProfile;

type ExportGameRequest = {
    base?: string;
    cachePolicy?: ExportCachePolicy;
    files: ({ bytes: number[]; path: string } | { path: string; sourcePath: string })[];
    gamePath: string;
    outDir?: string;
    zip?: boolean;
    zipFile?: string;
};

export async function exportGame(gamePath: string, options: ExportGameOptions = {}): Promise<ExportGameResult> {
    const resolvedOptions = resolveExportGameOptions(options);

    if (!isTauriRuntime()) {
        if (resolvedOptions.profile === 'desktop-tauri') {
            throw new Error('Desktop game packaging is available in the desktop editor. Use the desktop package command from a source checkout.');
        }
        const { exportGameForBrowser } = await import('./browserExportGame');
        return exportGameForBrowser(gamePath, resolvedOptions);
    }

    const { prepareWebGameArtifacts } = await import('./webGameArtifacts');
    const { artifactManifest, files, nativeFiles } = await prepareWebGameArtifacts(gamePath, resolvedOptions, { nativeProjectFiles: true });
    const request: ExportGameRequest = {
        base: resolvedOptions.base,
        cachePolicy: resolvedOptions.cachePolicy,
        files: [...Object.entries(files).map(([path, bytes]) => ({ bytes: [...bytes], path })), ...nativeFiles],
        gamePath,
        outDir: resolvedOptions.outDir,
        zip: resolvedOptions.zip,
        zipFile: resolvedOptions.zipFile,
    };

    const { invoke } = await import('@tauri-apps/api/core');
    const command = resolvedOptions.profile === 'desktop-tauri' ? 'export_desktop_game' : 'export_game';
    const result = await invoke<ExportGameResult>(command, { request });
    return { ...result, artifactManifest };
}

export function getExportProfileCatalog(): ExportProfileCatalogEntry[] {
    return EXPORT_PROFILE_CATALOG.map((entry) => ({ ...entry }));
}

export function getExportProfileMetadata(profile: ExportProfile): ExportProfileCatalogEntry {
    const metadata = EXPORT_PROFILE_CATALOG.find((entry) => entry.id === profile);
    if (!metadata) {
        throw new Error(`Unknown export profile: ${profile}`);
    }

    return { ...metadata };
}

export function resolveDesktopExportOutputPath(stdout: string, fallbackOutDirectory?: string): string | undefined {
    const outputPath = /^Built game from .+ to (.+) \(base: .+\)$/mu.exec(stdout)?.[1]?.trim();
    return outputPath || fallbackOutDirectory?.trim() || undefined;
}

export function resolveExportGameOptions(options: ExportGameOptions = {}): ExportGameOptions {
    const profile = options.profile ?? 'itch-html5';
    const preset = EXPORT_PROFILE_PRESETS[profile];
    return {
        ...preset,
        ...options,
        profile,
        ...(profile === 'desktop-tauri' ? { base: './', zip: false, zipFile: undefined } : {}),
    };
}

const EXPORT_PROFILE_CATALOG: ExportProfileCatalogEntry[] = [
    {
        description: 'A playable ZIP archive ready to upload to itch.io.',
        id: 'itch-html5',
        label: 'Itch.io HTML5',
        selectable: true,
        status: 'supported',
        target: 'web',
    },
    {
        description: 'Game files ready to upload to a web host.',
        id: 'generic-web',
        label: 'Generic web host',
        selectable: true,
        status: 'supported',
        target: 'web',
    },
    {
        description: 'Game files for testing on a local web server.',
        id: 'local-preview',
        label: 'Local preview',
        selectable: true,
        status: 'supported',
        target: 'web',
    },
    {
        description: 'A standalone game that runs without the editor.',
        id: 'desktop-tauri',
        label: 'Desktop app package',
        selectable: true,
        status: 'supported',
        target: 'desktop',
    },
    {
        description: 'Planned dual static deployment for playable exports and the browser editor after browser parity is complete.',
        id: 'github-pages-dual',
        label: 'GitHub Pages dual site',
        selectable: false,
        status: 'planned',
        target: 'web',
    },
];

const EXPORT_PROFILE_PRESETS: Record<ExportProfile, ExportGameOptions> = {
    'desktop-tauri': {
        base: './',
        cachePolicy: 'hashed',
        zip: false,
    },
    'generic-web': {
        base: './',
        cachePolicy: 'hashed',
        zip: false,
    },
    'itch-html5': {
        base: './',
        cachePolicy: 'hashed',
        zip: true,
    },
    'local-preview': {
        base: './',
        cachePolicy: 'none',
        zip: false,
    },
};
