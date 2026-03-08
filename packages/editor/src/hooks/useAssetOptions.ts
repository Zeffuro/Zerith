import { useEffect, useMemo, useState } from 'react';
import { fsReadDir, type FsDirEntry } from '../services/fs';
import { useProjectStore } from '../store/useProjectStore';

type AssetKind = 'bg' | 'sprite' | 'audio' | 'all';

type AssetOption = {
    label: string;
    value: string;
    absPath: string;
};

const BG_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);
const SPRITE_EXT = BG_EXT;
const AUDIO_EXT = new Set(['.mp3', '.ogg', '.wav', '.m4a']);

function getExt(name: string) {
    const idx = name.lastIndexOf('.');
    return idx >= 0 ? name.slice(idx).toLowerCase() : '';
}

function joinPath(a: string, b: string) {
    if (!a) return b;
    return `${a.replace(/\/+$/, '')}/${b.replace(/^\/+/, '')}`;
}

async function walk(dir: string): Promise<string[]> {
    const out: string[] = [];
    const entries: FsDirEntry[] = await fsReadDir(dir);

    for (const entry of entries) {
        const full = joinPath(dir, entry.name);
        if (entry.isDirectory) {
            out.push(...(await walk(full)));
        } else {
            out.push(full);
        }
    }

    return out;
}

function normalizeRel(projectPath: string, absPath: string) {
    const base = projectPath.replace(/\\/g, '/').replace(/\/+$/, '');
    const abs = absPath.replace(/\\/g, '/');
    if (abs.startsWith(base)) {
        const rel = abs.slice(base.length);
        return rel.startsWith('/') ? rel : `/${rel}`;
    }
    return absPath;
}

function matchKind(path: string, kind: AssetKind) {
    if (kind === 'all') return true;
    const ext = getExt(path);
    if (kind === 'bg') return BG_EXT.has(ext);
    if (kind === 'sprite') return SPRITE_EXT.has(ext);
    if (kind === 'audio') return AUDIO_EXT.has(ext);
    return true;
}

export function useAssetOptions(kind: AssetKind = 'all') {
    const projectPath = useProjectStore((s) => s.projectPath);

    const [assets, setAssets] = useState<AssetOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reload = async () => {
        if (!projectPath) {
            setAssets([]);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const assetsRoot = joinPath(projectPath, 'assets');
            const files = await walk(assetsRoot);

            const next = files
                .filter((p) => matchKind(p, kind))
                .map((absPath) => {
                    const value = normalizeRel(projectPath, absPath);
                    const label = value.replace(/^\/+/, '');
                    return { label, value, absPath };
                })
                .sort((a, b) => a.label.localeCompare(b.label));

            setAssets(next);
        } catch (e: any) {
            setAssets([]);
            setError(e?.message ?? 'Failed to load assets');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void reload();
    }, [projectPath, kind]);

    const values = useMemo(() => assets.map((a) => a.value), [assets]);

    return { assets, values, loading, error, reload };
}