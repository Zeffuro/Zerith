import type { BrowserDesktopExportArtifactManifest } from './browserParityReport';

import { collectExportArtifactManifest } from './exportArtifactManifest';
import { isTauriRuntime } from './runtime/runtimeEnvironment';

export type ExportCachePolicy = 'hashed' | 'none';

export type ExportGameOptions = {
    base?: string;
    cachePolicy?: ExportCachePolicy;
    download?: boolean;
    outDir?: string;
    profile?: ExportProfile;
    zip?: boolean;
    zipFile?: string;
};

export type ExportGameResult = {
    artifactManifest?: BrowserDesktopExportArtifactManifest;
    stderr: string;
    stdout: string;
};

export type ExportProfile = 'generic-web' | 'itch-html5' | 'local-preview';

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
    gamePath: string;
    outDir?: string;
    zip?: boolean;
    zipFile?: string;
};

export async function exportGame(gamePath: string, options: ExportGameOptions = {}): Promise<ExportGameResult> {
    const resolvedOptions = resolveExportGameOptions(options);

    if (!isTauriRuntime()) {
        const { exportGameForBrowser } = await import('./browserExportGame');
        return exportGameForBrowser(gamePath, resolvedOptions);
    }

    const request: ExportGameRequest = {
        base: resolvedOptions.base,
        cachePolicy: resolvedOptions.cachePolicy,
        gamePath,
        outDir: resolvedOptions.outDir,
        zip: resolvedOptions.zip,
        zipFile: resolvedOptions.zipFile,
    };

    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke<ExportGameResult>('export_game', { request });
    const outputPath = resolveDesktopExportOutputPath(result.stdout, resolvedOptions.outDir);
    if (!outputPath) return result;

    try {
        return {
            ...result,
            artifactManifest: await collectExportArtifactManifest(outputPath),
        };
    } catch {
        return result;
    }
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
    };
}

const EXPORT_PROFILE_CATALOG: ExportProfileCatalogEntry[] = [
    {
        description: 'Playable zip with relative paths and hashed compiled-content cache entries.',
        id: 'itch-html5',
        label: 'Itch.io HTML5',
        selectable: true,
        status: 'supported',
        target: 'web',
    },
    {
        description: 'Loose web build for a generic static host.',
        id: 'generic-web',
        label: 'Generic web host',
        selectable: true,
        status: 'supported',
        target: 'web',
    },
    {
        description: 'Loose uncached web build for local smoke testing.',
        id: 'local-preview',
        label: 'Local preview',
        selectable: true,
        status: 'supported',
        target: 'web',
    },
    {
        description: 'Planned packaged desktop game target; current desktop editor exports still produce web/player builds.',
        id: 'desktop-tauri',
        label: 'Desktop app package',
        selectable: false,
        status: 'planned',
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
