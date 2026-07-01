import type { BaseCommand, CompiledAssetDependencies, CompiledContentManifest, Script } from 'zerith-core';

type IdleTaskHandle = number | ReturnType<typeof globalThis.setTimeout>;

type RuntimeContentPrefetcher = {
    dispose: () => void;
    prefetchGlobalAndScene: (sceneName: string | undefined) => void;
    prefetchLikelyNextScenes: (sceneName: string) => void;
    prefetchScene: (sceneName: string) => void;
};

type RuntimeContentPrefetcherOptions = {
    compiledContent: CompiledContentManifest;
    logger?: Pick<Console, 'warn'>;
    resolveAssetUrl: (assetUrl: string) => string;
    scripts: Record<string, Script>;
};

const COMMAND_COLLECTION_KEYS = ['body', 'commands', 'onFalse', 'onTrue'] as const;

export function collectCompiledAssetUrls(dependencies: CompiledAssetDependencies | undefined): string[] {
    if (!dependencies) {
        return [];
    }

    return [
        ...dependencies.textures,
        ...dependencies.audio,
        ...dependencies.audiosheets,
        ...dependencies.spritesheets,
    ].filter((assetUrl) => assetUrl.trim().length > 0);
}

export function collectLikelyNextScenes(script: Script | undefined): string[] {
    const scenes = new Set<string>();

    const walk = (commands: BaseCommand[]) => {
        for (const command of commands) {
            if (command.type === 'jump' && typeof command.to === 'string' && command.to.trim()) {
                scenes.add(command.to);
            }

            for (const key of COMMAND_COLLECTION_KEYS) {
                const nestedCommands = command[key];
                if (Array.isArray(nestedCommands)) {
                    walk(nestedCommands as BaseCommand[]);
                }
            }

            const options = command.options;
            if (Array.isArray(options)) {
                for (const option of options) {
                    if (isRecord(option) && Array.isArray(option.commands)) {
                        walk(option.commands as BaseCommand[]);
                    }
                }
            }
        }
    };

    if (script) {
        walk(script);
    }

    return [...scenes].toSorted((left, right) => left.localeCompare(right));
}

export function createRuntimeContentPrefetcher(
    options: RuntimeContentPrefetcherOptions,
): RuntimeContentPrefetcher {
    const { compiledContent, logger = console, resolveAssetUrl, scripts } = options;
    const prefetchedAssets = new Set<string>();
    const scheduledTasks = new Set<IdleTaskHandle>();
    let disposed = false;

    const schedulePrefetch = (assetUrls: string[]) => {
        const unresolvedUrls = assetUrls.filter((assetUrl) => {
            const resolvedUrl = resolvePrefetchUrl(assetUrl);
            if (prefetchedAssets.has(resolvedUrl)) {
                return false;
            }

            prefetchedAssets.add(resolvedUrl);
            return true;
        });

        if (unresolvedUrls.length === 0) {
            return;
        }

        const handle = scheduleIdleTask(() => {
            scheduledTasks.delete(handle);
            if (disposed) {
                return;
            }

            for (const assetUrl of unresolvedUrls) {
                const resolvedUrl = resolvePrefetchUrl(assetUrl);
                void fetch(resolvedUrl)
                    .catch((error: unknown) => {
                        logger.warn(`[player] Failed to prefetch ${assetUrl}:`, error);
                    });
            }
        });

        scheduledTasks.add(handle);
    };
    const resolvePrefetchUrl = (assetUrl: string) => (
        resolveAssetUrl(resolveCompiledCacheUrl(assetUrl, compiledContent))
    );

    return {
        dispose() {
            disposed = true;
            for (const handle of scheduledTasks) {
                cancelIdleTask(handle);
            }
            scheduledTasks.clear();
            prefetchedAssets.clear();
        },
        prefetchGlobalAndScene(sceneName) {
            schedulePrefetch([
                ...collectCompiledAssetUrls(compiledContent.assets.global),
                ...(sceneName ? collectCompiledAssetUrls(compiledContent.assets.byScene[sceneName]) : []),
            ]);
        },
        prefetchLikelyNextScenes(sceneName) {
            const sceneNames = compiledContent.scenes[sceneName]?.nextScenes
                ?? collectLikelyNextScenes(scripts[sceneName]);
            schedulePrefetch(sceneNames.flatMap((nextSceneName) =>
                collectCompiledAssetUrls(compiledContent.assets.byScene[nextSceneName])
            ));
        },
        prefetchScene(sceneName) {
            schedulePrefetch(collectCompiledAssetUrls(compiledContent.assets.byScene[sceneName]));
        },
    };
}

export async function loadCompiledContentManifest(
    compiledContentUrl: string,
): Promise<CompiledContentManifest | undefined> {
    const response = await fetch(compiledContentUrl);

    if (response.status === 404) {
        return;
    }

    if (!response.ok) {
        throw new Error(`Failed to load compiled content manifest from ${compiledContentUrl} (${response.status}).`);
    }

    return response.json() as Promise<CompiledContentManifest>;
}

export function resolveCompiledCacheUrl(
    assetUrl: string,
    compiledContent: CompiledContentManifest,
): string {
    const cachePath = normalizeCompiledCachePath(assetUrl);
    const hash = cachePath ? compiledContent.cache?.entries[cachePath]?.hash : undefined;

    return hash ? appendCacheVersion(assetUrl, hash) : assetUrl;
}

function appendCacheVersion(assetUrl: string, hash: string): string {
    const hashIndex = assetUrl.indexOf('#');

    if (hashIndex === -1) {
        return appendCacheVersionBeforeFragment(assetUrl, '', hash);
    }

    return appendCacheVersionBeforeFragment(
        assetUrl.slice(0, hashIndex),
        assetUrl.slice(hashIndex),
        hash,
    );
}

function appendCacheVersionBeforeFragment(pathAndSearch: string, fragment: string, hash: string): string {
    const searchIndex = pathAndSearch.indexOf('?');

    if (searchIndex === -1) {
        return `${pathAndSearch}?v=${encodeURIComponent(hash)}${fragment}`;
    }

    const path = pathAndSearch.slice(0, searchIndex);
    const search = pathAndSearch.slice(searchIndex + 1);
    const parameters = new URLSearchParams(search);

    parameters.set('v', hash);
    return `${path}?${parameters.toString()}${fragment}`;
}

function cancelIdleTask(handle: IdleTaskHandle): void {
    const cancelIdleCallback = globalThis.cancelIdleCallback;
    if (typeof cancelIdleCallback === 'function' && typeof handle === 'number') {
        cancelIdleCallback(handle);
        return;
    }

    globalThis.clearTimeout(handle);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function normalizeCompiledCachePath(assetUrl: string): string | undefined {
    const normalized = assetUrl.trim();
    if (!normalized || /^(?:[a-z]+:)?\/\//iu.test(normalized) || normalized.startsWith('data:')) {
        return;
    }

    const [pathOnly = ''] = normalized.split(/[?#]/u, 1);
    const cachePath = pathOnly.replaceAll('\\', '/').replace(/^\/+/u, '');
    return cachePath.length > 0 ? cachePath : undefined;
}

function scheduleIdleTask(callback: () => void): IdleTaskHandle {
    const requestIdleCallback = globalThis.requestIdleCallback;
    if (typeof requestIdleCallback === 'function') {
        return requestIdleCallback(callback);
    }

    return globalThis.setTimeout(callback, 0);
}
