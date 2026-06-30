import type { ScriptPath } from '../../utils/scriptPathUtilities';

export type DialogueLineIdStatus = 'custom' | 'generated' | 'missing' | 'unknown';

export interface DialogueLineIdSummary {
    detail: string;
    expectedLineId?: string;
    status: DialogueLineIdStatus;
    title: string;
}

export interface DialogueVoiceDraft {
    assetUrl: string;
    cue: string;
    volume: string;
}

export function buildGeneratedDialogueLineId(
    namespace: string | undefined,
    path: ScriptPath | undefined,
): string | undefined {
    const prefix = toStableIdPrefix(namespace);
    const migrationPath = toMigrationNumericPath(path);
    if (!prefix || migrationPath.length === 0) return undefined;
    return `${prefix}.line.${migrationPath.map((segment) => formatPathSegment(segment)).join('.')}`;
}

export function createDialogueVoiceValue(draft: DialogueVoiceDraft): unknown {
    const rawAssetUrl = draft.assetUrl.trim();
    const parsed = parseCueReference(rawAssetUrl);
    const assetUrl = parsed?.sheetUrl ?? rawAssetUrl;
    const cue = (draft.cue.trim() || parsed?.cueName || '').trim();
    const volume = draft.volume.trim() ? Number(draft.volume) : undefined;

    if (!assetUrl) return undefined;

    return {
        assetUrl,
        ...(cue ? { cue } : {}),
        ...(typeof volume === 'number' && Number.isFinite(volume) ? { volume } : {}),
    };
}

export function readDialogueBacklogVisibility(value: unknown): 'hide' | 'show' {
    return value === 'hide' ? 'hide' : 'show';
}

export function readDialogueVoiceDraft(value: unknown): DialogueVoiceDraft {
    if (typeof value === 'string') {
        return {
            assetUrl: value.trim(),
            cue: '',
            volume: '',
        };
    }

    if (!isRecord(value)) {
        return {
            assetUrl: '',
            cue: '',
            volume: '',
        };
    }

    const volume = typeof value.volume === 'number' && Number.isFinite(value.volume)
        ? String(value.volume)
        : '';

    return {
        assetUrl: typeof value.assetUrl === 'string' ? value.assetUrl : '',
        cue: typeof value.cue === 'string' ? value.cue : '',
        volume,
    };
}

export function summarizeDialogueLineId(
    lineId: string | undefined,
    expectedLineId: string | undefined,
): DialogueLineIdSummary {
    const currentLineId = lineId?.trim();

    if (!expectedLineId) {
        return currentLineId
            ? {
                detail: 'Selected line is using a preserved ID.',
                status: 'custom',
                title: 'Preserved ID',
            }
            : {
                detail: 'Select a scene line to generate a deterministic ID.',
                status: 'unknown',
                title: 'No generated ID available',
            };
    }

    if (!currentLineId) {
        return {
            detail: 'Backlog, localization, and voice review work best with a stable line ID.',
            expectedLineId,
            status: 'missing',
            title: 'Missing ID',
        };
    }

    if (currentLineId === expectedLineId) {
        return {
            detail: 'Matches the deterministic scene path ID.',
            expectedLineId,
            status: 'generated',
            title: 'Generated ID',
        };
    }

    return {
        detail: 'Custom ID is preserved unless you regenerate it.',
        expectedLineId,
        status: 'custom',
        title: 'Preserved custom ID',
    };
}

function formatPathSegment(value: number): string {
    return value.toString().padStart(3, '0');
}

function isHttpUrl(value: string): boolean {
    return /^[a-z][a-z+.-]*:\/\//i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function parseCueReference(assetUrl: string): { cueName: string; sheetUrl: string } | undefined {
    if (!assetUrl.includes(':') || isHttpUrl(assetUrl)) return undefined;

    const separatorIndex = assetUrl.lastIndexOf(':');
    if (separatorIndex <= 0 || separatorIndex >= assetUrl.length - 1) return undefined;

    const sheetUrl = assetUrl.slice(0, separatorIndex).trim();
    const cueName = assetUrl.slice(separatorIndex + 1).trim();
    return sheetUrl && cueName ? { cueName, sheetUrl } : undefined;
}

function toMigrationNumericPath(path: ScriptPath | undefined): number[] {
    if (!path) return [];
    return path
        .filter((segment): segment is number => typeof segment === 'number')
        .map((segment) => segment + 1);
}

function toStableIdPrefix(value: string | undefined): string | undefined {
    const normalized = value
        ?.trim()
        .replaceAll(/[^a-zA-Z0-9_.-]+/gu, '.')
        .replaceAll(/^\.+|\.+$/gu, '');

    return normalized || undefined;
}
