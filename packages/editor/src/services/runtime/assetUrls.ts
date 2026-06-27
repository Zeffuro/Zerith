import type { AssetResolver } from 'core';

import { fsReadBinaryFile } from '../fs';
import { isTauriRuntime } from './runtimeEnvironment';

type ObjectUrlEntry = {
    refCount: number;
    revokeOnRelease: boolean;
    url: string;
};

let tauriCoreApiPromise: Promise<typeof import('@tauri-apps/api/core')> | undefined;

const objectUrlEntriesByPath = new Map<string, ObjectUrlEntry>();
const objectUrlPathsByUrl = new Map<string, string>();

export function createProjectAssetResolver(projectPath: string): { dispose: () => void; resolve: AssetResolver } {
    const resolvedUrls: string[] = [];
    let disposed = false;

    return {
        dispose: () => {
            disposed = true;
            for (const url of resolvedUrls) {
                releaseEditorAssetUrl(url);
            }
            resolvedUrls.length = 0;
        },
        resolve: async (assetUrl: string) => {
            const resolvedUrl = await resolveProjectAssetUrl(assetUrl, projectPath);
            if (disposed) {
                releaseEditorAssetUrl(resolvedUrl);
                return resolvedUrl;
            }
            resolvedUrls.push(resolvedUrl);
            return resolvedUrl;
        },
    };
}

export function releaseEditorAssetUrl(url: string): void {
    const path = objectUrlPathsByUrl.get(url);
    if (!path) return;

    const entry = objectUrlEntriesByPath.get(path);
    if (!entry) {
        objectUrlPathsByUrl.delete(url);
        return;
    }

    entry.refCount -= 1;
    if (entry.refCount > 0) return;

    if (entry.revokeOnRelease) {
        URL.revokeObjectURL(entry.url);
    }
    objectUrlEntriesByPath.delete(path);
    objectUrlPathsByUrl.delete(entry.url);
}

export async function resolveEditorAssetUrl(path: string): Promise<string> {
    if (isExternallyLoadableAssetUrl(path)) {
        return path;
    }

    if (isTauriRuntime()) {
        const { convertFileSrc } = await getTauriCoreApi();
        return convertFileSrc(path);
    }

    const existingEntry = objectUrlEntriesByPath.get(path);
    if (existingEntry) {
        existingEntry.refCount += 1;
        return existingEntry.url;
    }

    const bytes = await fsReadBinaryFile(path);
    const blobBytes = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const mimeType = inferMimeType(path);
    const blob = new Blob([blobBytes], { type: mimeType });
    const useDataUrl = shouldUseDataUrl(mimeType);
    const url = useDataUrl
        ? await blobToDataUrl(blob)
        : URL.createObjectURL(blob);
    objectUrlEntriesByPath.set(path, { refCount: 1, revokeOnRelease: !useDataUrl, url });
    objectUrlPathsByUrl.set(url, path);
    return url;
}

export async function resolveProjectAssetUrl(assetUrl: string, projectPath: string): Promise<string> {
    if (isExternallyLoadableAssetUrl(assetUrl)) {
        return assetUrl;
    }

    const decodedAssetUrl = decodeLocalAssetPath(assetUrl);
    if (isAbsoluteDesktopPath(decodedAssetUrl)) {
        return resolveEditorAssetUrl(decodedAssetUrl);
    }

    if (decodedAssetUrl === projectPath || decodedAssetUrl.startsWith(`${projectPath}/`)) {
        return resolveEditorAssetUrl(decodedAssetUrl);
    }

    const slashPrefixedPath = decodedAssetUrl.startsWith('/') ? decodedAssetUrl : `/${decodedAssetUrl}`;
    return resolveEditorAssetUrl(`${projectPath}${slashPrefixedPath}`);
}

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            resolve(typeof reader.result === 'string' ? reader.result : '');
        });
        reader.addEventListener('error', () => {
            reject(reader.error ?? new Error('Failed to convert asset to data URL.'));
        });
        reader.readAsDataURL(blob);
    });
}

function decodeLocalAssetPath(assetUrl: string): string {
    try {
        return decodeURIComponent(assetUrl);
    } catch {
        return assetUrl;
    }
}

async function getTauriCoreApi(): Promise<typeof import('@tauri-apps/api/core')> {
    tauriCoreApiPromise ??= import('@tauri-apps/api/core');
    return tauriCoreApiPromise;
}

function inferMimeType(path: string): string {
    const extension = path.slice(Math.max(0, path.lastIndexOf('.') + 1)).toLowerCase();
    switch (extension) {
        case 'avif': {
            return 'image/avif';
        }
        case 'gif': {
            return 'image/gif';
        }
        case 'jpeg': {
            return 'image/jpeg';
        }
        case 'jpg': {
            return 'image/jpeg';
        }
        case 'json': {
            return 'application/json';
        }
        case 'mp3': {
            return 'audio/mpeg';
        }
        case 'ogg': {
            return 'audio/ogg';
        }
        case 'otf': {
            return 'font/otf';
        }
        case 'png': {
            return 'image/png';
        }
        case 'svg': {
            return 'image/svg+xml';
        }
        case 'ttf': {
            return 'font/ttf';
        }
        case 'wav': {
            return 'audio/wav';
        }
        case 'webm': {
            return 'audio/webm';
        }
        case 'webp': {
            return 'image/webp';
        }
        case 'woff': {
            return 'font/woff';
        }
        case 'woff2': {
            return 'font/woff2';
        }
        default: {
            return 'application/octet-stream';
        }
    }
}

function isAbsoluteDesktopPath(path: string): boolean {
    return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('\\\\');
}

function isExternallyLoadableAssetUrl(url: string): boolean {
    return /^(?:[a-z][a-z+.-]*:)?\/\//i.test(url)
        || /^(?:asset|blob|data|file):/i.test(url);
}

function shouldUseDataUrl(mimeType: string): boolean {
    return mimeType === 'application/json'
        || mimeType.startsWith('font/')
        || mimeType.startsWith('image/');
}
