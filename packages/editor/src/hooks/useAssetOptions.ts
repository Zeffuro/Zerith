import { useCallback, useEffect, useMemo, useState } from 'react';

import { type FsDirectoryEntry, fsReadDirectory } from '../services/fs';
import { useProjectStore } from '../store/useProjectStore';

type AssetKind = 'all' | 'audio' | 'bg' | 'bgm' | 'sfx' | 'sprite';

type AssetOption = {
    absPath: string;
    label: string;
    value: string;
};

const BG_EXT = new Set(['.avif', '.jpeg', '.jpg', '.png', '.webp']);
const SPRITE_EXT = BG_EXT;
const AUDIO_EXT = new Set(['.m4a', '.mp3', '.ogg', '.wav']);

export function useAssetOptions(kind: AssetKind = 'all') {
    const projectPath = useProjectStore((s) => s.projectPath);

    const [assets, setAssets] = useState<AssetOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | undefined>();

    const reload = useCallback(async () => {
        if (!projectPath) {
            setAssets([]);
            setError(undefined);
            return;
        }

        setLoading(true);
        setError(undefined);

        try {
            const assetsRoot = joinPath(projectPath, 'assets');
            const files = await walk(assetsRoot);

            const next = files
                .filter((p) => matchKind(p, kind))
                .map((absPath) => {
                    const value = normalizeRelativePath(projectPath, absPath);
                    const label = value.replace(/^\/+/, '');
                    return { absPath, label, value };
                })
                .toSorted((a, b) => a.label.localeCompare(b.label));

            setAssets(next);
        } catch (error_) {
            setAssets([]);
            const message = error_ instanceof Error ? error_.message : 'Failed to load assets';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [kind, projectPath]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const values = useMemo(() => assets.map((a) => a.value), [assets]);

    return { assets, error, loading, reload, values };
}

function getExtension(name: string) {
    const index = name.lastIndexOf('.');
    return index === -1 ? '' : name.slice(index).toLowerCase();
}

function joinPath(a: string, b: string) {
    if (!a) return b;
    return `${a.replace(/\/+$/, '')}/${b.replace(/^\/+/, '')}`;
}

function matchKind(path: string, kind: AssetKind) {
    if (kind === 'all') return true;
    const extension = getExtension(path);
    if (kind === 'bg') return BG_EXT.has(extension);
    if (kind === 'sprite') return SPRITE_EXT.has(extension);
    if (kind === 'audio' || kind === 'bgm' || kind === 'sfx') return AUDIO_EXT.has(extension);
    return true;
}

function normalizeRelativePath(projectPath: string, absPath: string) {
    const base = projectPath.replaceAll('\\', '/').replace(/\/+$/, '');
    const abs = absPath.replaceAll('\\', '/');
    if (abs.startsWith(base)) {
        const relative = abs.slice(base.length);
        return relative.startsWith('/') ? relative : `/${relative}`;
    }
    return absPath;
}

async function walk(directory: string): Promise<string[]> {
    const out: string[] = [];
    const entries: FsDirectoryEntry[] = await fsReadDirectory(directory);

    for (const entry of entries) {
        const full = joinPath(directory, entry.name);
        if (entry.isDirectory) {
            out.push(...(await walk(full)));
        } else {
            out.push(full);
        }
    }

    return out;
}