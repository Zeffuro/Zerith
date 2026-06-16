import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type FsDirectoryEntry, fsReadDirectory, fsReadTextFile } from '../services/fs';
import { useProjectStore } from '../store/storeBootstrap';
import { AUDIO_EXT, FONT_EXT, getExtension, IMG_EXT } from '../utils/assetTypes';

type AssetKind = 'all' | 'audio' | 'bg' | 'bgm' | 'font' | 'sfx' | 'sprite';

type AssetOption = {
    absPath: string;
    label: string;
    value: string;
};

const BG_EXT = IMG_EXT;
const AUDIO_KINDS = new Set<AssetKind>(['audio', 'bgm', 'sfx']);
const SPRITE_EXT = IMG_EXT;

export function useAssetOptions(kind: AssetKind = 'all') {
    const projectPath = useProjectStore((s) => s.projectPath);

    const [assets, setAssets] = useState<AssetOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const requestVersionReference = useRef(0);

    const reload = useCallback(async () => {
        const requestVersion = ++requestVersionReference.current;

        if (!projectPath) {
            if (requestVersion === requestVersionReference.current) {
                setAssets([]);
                setError(undefined);
                setLoading(false);
            }
            return;
        }

        setLoading(true);
        setError(undefined);

        try {
            const assetsRoot = joinPath(projectPath, 'assets');
            const files = await walk(assetsRoot);

            const optionGroups = await Promise.all(files.map(async (absPath) => {
                    if (!matchKind(absPath, kind)) return [];

                    const value = normalizeRelativePath(projectPath, absPath);
                    const label = value.replace(/^\/+/, '');
                    const option = { absPath, label, value };

                    if (!AUDIO_KINDS.has(kind) && kind !== 'all') {
                        return [option];
                    }

                    const cueOptions = await readAudiosheetCueOptions(absPath, projectPath);
                    return cueOptions.length > 0 ? cueOptions : [option];
                }));
            const next = optionGroups
                .flat()
                .toSorted((a, b) => a.label.localeCompare(b.label));

            if (requestVersion === requestVersionReference.current) {
                setAssets(next);
            }
        } catch (error_) {
            if (requestVersion === requestVersionReference.current) {
                setAssets([]);
                const message = error_ instanceof Error ? error_.message : 'Failed to load assets';
                setError(message);
            }
        } finally {
            if (requestVersion === requestVersionReference.current) {
                setLoading(false);
            }
        }
    }, [kind, projectPath]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const values = useMemo(() => assets.map((a) => a.value), [assets]);

    return { assets, error, loading, reload, values };
}


function isAudiosheetPath(path: string): boolean {
    return path.toLowerCase().endsWith('.sheet.json');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function joinPath(a: string, b: string) {
    if (!a) return b;
    return `${a.replace(/\/+$/, '')}/${b.replace(/^\/+/, '')}`;
}

function matchKind(path: string, kind: AssetKind) {
    if (kind === 'all') return true;
    const extension = getExtension(path);
    if (kind === 'bg') return BG_EXT.has(extension);
    if (kind === 'font') return FONT_EXT.has(extension);
    if (kind === 'sprite') return SPRITE_EXT.has(extension);
    if (AUDIO_KINDS.has(kind)) return AUDIO_EXT.has(extension) || isAudiosheetPath(path);
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

async function readAudiosheetCueOptions(absPath: string, projectPath: string): Promise<AssetOption[]> {
    if (!isAudiosheetPath(absPath)) return [];

    let data: unknown;
    try {
        data = JSON.parse(await fsReadTextFile(absPath));
    } catch {
        return [];
    }

    if (!isRecord(data) || !isRecord(data.cues)) return [];

    const sheetUrl = normalizeRelativePath(projectPath, absPath);
    return Object.keys(data.cues)
        .toSorted((left, right) => left.localeCompare(right))
        .map((cueName) => {
            const value = `${sheetUrl}:${cueName}`;
            return {
                absPath,
                label: value.replace(/^\/+/, ''),
                value,
            };
        });
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
