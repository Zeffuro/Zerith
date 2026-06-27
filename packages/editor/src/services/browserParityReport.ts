export type BrowserDesktopExportArtifactCheck = {
    browser: string;
    desktop: string;
    id: BrowserDesktopExportArtifactCheckId;
    missingInBrowser: string[];
    missingInDesktop: string[];
    note: string;
    status: BrowserDesktopExportArtifactStatus;
};

export type BrowserDesktopExportArtifactCheckId =
    | 'compiledContent'
    | 'entryHtml'
    | 'projectFiles'
    | 'runtimeAssets';

export type BrowserDesktopExportArtifactComparison = {
    checks: BrowserDesktopExportArtifactCheck[];
    summary: Record<BrowserDesktopExportArtifactStatus, number>;
};

export type BrowserDesktopExportArtifactManifest = {
    fileHashes?: Record<string, string>;
    files: readonly string[];
    projectFiles?: readonly string[];
};

export type BrowserDesktopExportArtifactStatus =
    | 'matched'
    | 'mismatched'
    | 'missing';

export type BrowserExportParityComparison = {
    features: BrowserExportParityFeature[];
    summary: Record<BrowserExportParityFeatureStatus, number>;
};

export type BrowserExportParityFeature = {
    browser: string;
    desktop: string;
    id: BrowserExportParityFeatureId;
    note: string;
    status: BrowserExportParityFeatureStatus;
};

export type BrowserExportParityFeatureId =
    | 'baseUrl'
    | 'buildPipeline'
    | 'cachePolicy'
    | 'compiledContent'
    | 'looseOutput'
    | 'playerRuntime'
    | 'zipArchive';

export type BrowserExportParityFeatureStatus =
    | 'browser-limited'
    | 'desktop-only'
    | 'matched';

export type BrowserParityCapability = {
    browser: ParityCapabilityStatus;
    desktop: ParityCapabilityStatus;
    id: BrowserParityCapabilityId;
    note: string;
};

export type BrowserParityCapabilityId =
    | 'appClose'
    | 'browserEditor'
    | 'exportGame'
    | 'projectFileSystem'
    | 'revealInFileManager';

export type BrowserParityReport = {
    capabilities: BrowserParityCapability[];
    exportComparison: BrowserExportParityComparison;
    runtime: EditorRuntimeSurface;
    summary: {
        limited: number;
        supported: number;
        unsupported: number;
    };
};

export type BrowserParityReportOptions = {
    browserFileSystemAccess?: boolean;
    runtime: EditorRuntimeSurface;
};

export type CreateBrowserDesktopExportArtifactManifestOptions = {
    fileHashes?: Record<string, string>;
    projectFiles?: readonly string[];
};

export type EditorRuntimeSurface = 'browser' | 'desktop';

export type ParityCapabilityStatus = 'limited' | 'supported' | 'unsupported';

const PARITY_CAPABILITIES: readonly Omit<BrowserParityCapability, 'browser'>[] = [
    {
        desktop: 'supported',
        id: 'browserEditor',
        note: 'The editor can run as a web app, but browser sessions are bounded by browser storage and picker permissions.',
    },
    {
        desktop: 'supported',
        id: 'projectFileSystem',
        note: 'Desktop uses the native filesystem adapter; browser builds require File System Access API support and user-granted handles.',
    },
    {
        desktop: 'supported',
        id: 'revealInFileManager',
        note: 'System reveal is a desktop-only capability. Browser builds cannot reveal arbitrary local paths.',
    },
    {
        desktop: 'supported',
        id: 'appClose',
        note: 'Desktop can close the app window through Tauri. Browser builds can only request window close, which browsers may ignore.',
    },
    {
        desktop: 'supported',
        id: 'exportGame',
        note: 'Desktop export can write to chosen output paths. Browser export produces a playable zip download from the mounted project and player shell.',
    },
];

const EXPORT_PARITY_FEATURES: readonly BrowserExportParityFeature[] = [
    {
        browser: 'Uses the editor-bundled player shell from player/dist.',
        desktop: 'Runs the player Vite production build for the selected game.',
        id: 'buildPipeline',
        note: 'Desktop still owns the canonical Vite build path; browser export depends on a prebuilt player shell embedded into the editor bundle.',
        status: 'browser-limited',
    },
    {
        browser: 'Rewrites the embedded player shell and includes player runtime assets.',
        desktop: 'Builds and emits the player runtime assets.',
        id: 'playerRuntime',
        note: 'Both exports produce a playable runtime shell, but through different build mechanics.',
        status: 'matched',
    },
    {
        browser: 'Adds zerith.content.json to the zip from the mounted project.',
        desktop: 'Writes zerith.content.json after the Vite build.',
        id: 'compiledContent',
        note: 'Both export paths include the compiled content manifest.',
        status: 'matched',
    },
    {
        browser: 'Supports hashed and none cache policy when producing zerith.content.json.',
        desktop: 'Supports hashed and none cache policy through the build-game script.',
        id: 'cachePolicy',
        note: 'Both export paths now expose the same compiled-content cache policy choices.',
        status: 'matched',
    },
    {
        browser: 'Records the requested base URL in the export log while emitting a zip download.',
        desktop: 'Passes the requested base URL into the Vite build.',
        id: 'baseUrl',
        note: 'Desktop applies base URL at build time; browser export is constrained by the prebuilt player shell.',
        status: 'browser-limited',
    },
    {
        browser: 'Always downloads a zip archive, even when zip is disabled.',
        desktop: 'Can emit a loose web build and optionally create a zip archive.',
        id: 'zipArchive',
        note: 'Browser export cannot write a loose directory tree without a later browser filesystem output policy.',
        status: 'browser-limited',
    },
    {
        browser: 'Cannot write arbitrary output directories or zip paths.',
        desktop: 'Supports explicit outDir and zipFile destinations.',
        id: 'looseOutput',
        note: 'Desktop remains the only path with direct filesystem output destinations.',
        status: 'desktop-only',
    },
];

export function compareBrowserDesktopExportArtifacts(
    browserArtifact: BrowserDesktopExportArtifactManifest,
    desktopArtifact: BrowserDesktopExportArtifactManifest,
): BrowserDesktopExportArtifactComparison {
    const browserFiles = normalizeArtifactFileSet(browserArtifact.files);
    const desktopFiles = normalizeArtifactFileSet(desktopArtifact.files);
    const checks: BrowserDesktopExportArtifactCheck[] = [
        compareRequiredFile('entryHtml', 'index.html', browserFiles, desktopFiles),
        compareCompiledContent(browserArtifact, desktopArtifact, browserFiles, desktopFiles),
        compareRuntimeAssets(browserFiles, desktopFiles),
        compareProjectFiles(browserArtifact, desktopArtifact, browserFiles, desktopFiles),
    ];

    return {
        checks,
        summary: {
            matched: checks.filter((check) => check.status === 'matched').length,
            mismatched: checks.filter((check) => check.status === 'mismatched').length,
            missing: checks.filter((check) => check.status === 'missing').length,
        },
    };
}

export function createBrowserDesktopExportArtifactManifest(
    files: readonly string[],
    options: CreateBrowserDesktopExportArtifactManifestOptions = {},
): BrowserDesktopExportArtifactManifest {
    return {
        ...(options.fileHashes === undefined ? {} : { fileHashes: normalizeArtifactFileHashes(options.fileHashes) }),
        files: uniqueSorted(files.map((file) => normalizeArtifactPath(file))),
        projectFiles: uniqueSorted((options.projectFiles ?? []).map((file) => normalizeArtifactPath(file))),
    };
}

export function createBrowserExportParityComparison(): BrowserExportParityComparison {
    return {
        features: EXPORT_PARITY_FEATURES.map((feature) => ({ ...feature })),
        summary: {
            'browser-limited': EXPORT_PARITY_FEATURES.filter((feature) => feature.status === 'browser-limited').length,
            'desktop-only': EXPORT_PARITY_FEATURES.filter((feature) => feature.status === 'desktop-only').length,
            matched: EXPORT_PARITY_FEATURES.filter((feature) => feature.status === 'matched').length,
        },
    };
}

export function createBrowserParityReport(options: BrowserParityReportOptions): BrowserParityReport {
    const capabilities = PARITY_CAPABILITIES.map((capability): BrowserParityCapability => ({
        ...capability,
        browser: getBrowserCapabilityStatus(capability.id, options),
    }));
    const runtimeStatuses = capabilities.map((capability) => capability[options.runtime]);

    return {
        capabilities,
        exportComparison: createBrowserExportParityComparison(),
        runtime: options.runtime,
        summary: {
            limited: runtimeStatuses.filter((status) => status === 'limited').length,
            supported: runtimeStatuses.filter((status) => status === 'supported').length,
            unsupported: runtimeStatuses.filter((status) => status === 'unsupported').length,
        },
    };
}

function compareCompiledContent(
    browserArtifact: BrowserDesktopExportArtifactManifest,
    desktopArtifact: BrowserDesktopExportArtifactManifest,
    browserFiles: Set<string>,
    desktopFiles: Set<string>,
): BrowserDesktopExportArtifactCheck {
    const presence = compareRequiredFile('compiledContent', 'zerith.content.json', browserFiles, desktopFiles);
    if (presence.status !== 'matched') return presence;

    const browserHash = getArtifactFileHash(browserArtifact, 'zerith.content.json');
    const desktopHash = getArtifactFileHash(desktopArtifact, 'zerith.content.json');
    if (!browserHash || !desktopHash) {
        return {
            ...presence,
            note: 'Both exports include zerith.content.json; hashes were not provided for content diffing.',
        };
    }

    if (browserHash !== desktopHash) {
        return {
            ...presence,
            browser: browserHash,
            desktop: desktopHash,
            note: 'Both exports include zerith.content.json, but their content hashes differ.',
            status: 'mismatched',
        };
    }

    return {
        ...presence,
        browser: browserHash,
        desktop: desktopHash,
        note: 'Both exports include matching compiled-content manifests.',
    };
}

function compareProjectFiles(
    browserArtifact: BrowserDesktopExportArtifactManifest,
    desktopArtifact: BrowserDesktopExportArtifactManifest,
    browserFiles: Set<string>,
    desktopFiles: Set<string>,
): BrowserDesktopExportArtifactCheck {
    const expectedProjectFiles = uniqueSorted([
        ...(browserArtifact.projectFiles ?? []),
        ...(desktopArtifact.projectFiles ?? []),
    ].map((file) => normalizeArtifactPath(file)));
    const missingInBrowser = expectedProjectFiles.filter((file) => !browserFiles.has(file));
    const missingInDesktop = expectedProjectFiles.filter((file) => !desktopFiles.has(file));

    return {
        browser: `${expectedProjectFiles.length - missingInBrowser.length}/${expectedProjectFiles.length} project files`,
        desktop: `${expectedProjectFiles.length - missingInDesktop.length}/${expectedProjectFiles.length} project files`,
        id: 'projectFiles',
        missingInBrowser,
        missingInDesktop,
        note: expectedProjectFiles.length === 0
            ? 'No expected project files were provided for artifact comparison.'
            : 'Browser zip and desktop Vite export should both carry project publicDir files.',
        status: missingInBrowser.length > 0 || missingInDesktop.length > 0 ? 'missing' : 'matched',
    };
}

function compareRequiredFile(
    id: BrowserDesktopExportArtifactCheckId,
    path: string,
    browserFiles: Set<string>,
    desktopFiles: Set<string>,
): BrowserDesktopExportArtifactCheck {
    const normalizedPath = normalizeArtifactPath(path);
    const browserHasFile = browserFiles.has(normalizedPath);
    const desktopHasFile = desktopFiles.has(normalizedPath);

    return {
        browser: browserHasFile ? 'present' : 'missing',
        desktop: desktopHasFile ? 'present' : 'missing',
        id,
        missingInBrowser: browserHasFile ? [] : [normalizedPath],
        missingInDesktop: desktopHasFile ? [] : [normalizedPath],
        note: `${normalizedPath} must exist in both browser zip and desktop export artifacts.`,
        status: browserHasFile && desktopHasFile ? 'matched' : 'missing',
    };
}

function compareRuntimeAssets(
    browserFiles: Set<string>,
    desktopFiles: Set<string>,
): BrowserDesktopExportArtifactCheck {
    const browserRuntimeFiles = [...browserFiles].filter((file) => /^zerith-player\/.+\.js$/u.test(file));
    const desktopRuntimeFiles = [...desktopFiles].filter((file) => /^assets\/.+\.js$/u.test(file));

    return {
        browser: `${browserRuntimeFiles.length} remapped player JS files`,
        desktop: `${desktopRuntimeFiles.length} Vite player JS files`,
        id: 'runtimeAssets',
        missingInBrowser: browserRuntimeFiles.length > 0 ? [] : ['zerith-player/*.js'],
        missingInDesktop: desktopRuntimeFiles.length > 0 ? [] : ['assets/*.js'],
        note: 'Browser zip remaps the prebuilt player runtime while desktop export emits the Vite player runtime.',
        status: browserRuntimeFiles.length > 0 && desktopRuntimeFiles.length > 0 ? 'matched' : 'missing',
    };
}

function getArtifactFileHash(
    artifact: BrowserDesktopExportArtifactManifest,
    path: string,
): string | undefined {
    const normalizedPath = normalizeArtifactPath(path);
    const entry = Object.entries(artifact.fileHashes ?? {})
        .find(([filePath]) => normalizeArtifactPath(filePath) === normalizedPath);
    return entry?.[1];
}

function getBrowserCapabilityStatus(
    capabilityId: BrowserParityCapabilityId,
    options: BrowserParityReportOptions,
): ParityCapabilityStatus {
    switch (capabilityId) {
        case 'appClose':
        case 'exportGame': {
            return 'limited';
        }
        case 'browserEditor': {
            return 'supported';
        }
        case 'projectFileSystem': {
            return options.browserFileSystemAccess ? 'limited' : 'unsupported';
        }
        case 'revealInFileManager': {
            return 'unsupported';
        }
    }
}

function normalizeArtifactFileHashes(fileHashes: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
        Object.entries(fileHashes).map(([file, hash]) => [normalizeArtifactPath(file), hash]),
    );
}

function normalizeArtifactFileSet(files: readonly string[]): Set<string> {
    return new Set(files.map((file) => normalizeArtifactPath(file)));
}

function normalizeArtifactPath(path: string): string {
    return path.trim().replaceAll('\\', '/').replaceAll(/^\/+/gu, '');
}

function uniqueSorted(values: string[]): string[] {
    return [...new Set(values.filter((value) => value.length > 0))]
        .toSorted((left, right) => left.localeCompare(right));
}
