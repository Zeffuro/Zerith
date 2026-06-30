import type { DialogueVoiceAttachment } from '../types';

type VoiceRecord = Record<string, unknown>;

export function describeDialogueVoiceAttachment(value: unknown): string | undefined {
    const attachment = normalizeDialogueVoiceAttachment(value);
    if (!attachment) return undefined;
    return attachment.cue ? `${attachment.assetUrl}:${attachment.cue}` : attachment.assetUrl;
}

export function normalizeDialogueVoiceAttachment(value: unknown): DialogueVoiceAttachment | undefined {
    if (typeof value === 'string') {
        return normalizeVoiceAsset(value);
    }

    if (!isRecord(value)) return undefined;

    const assetUrl = normalizeString(value.assetUrl);
    if (!assetUrl) return undefined;

    const cue = normalizeString(value.cue);
    const volume = normalizeVoiceVolume(value.volume);

    return {
        assetUrl,
        ...(cue ? { cue } : {}),
        ...(volume === undefined ? {} : { volume }),
    };
}

export function toDialogueVoiceAssetReference(value: unknown): string | undefined {
    const attachment = normalizeDialogueVoiceAttachment(value);
    if (!attachment) return undefined;
    return attachment.cue ? `${attachment.assetUrl}:${attachment.cue}` : attachment.assetUrl;
}

function isRecord(value: unknown): value is VoiceRecord {
    return typeof value === 'object' && value !== null;
}

function normalizeString(value: unknown): string | undefined {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized.length > 0 ? normalized : undefined;
}

function normalizeVoiceAsset(value: string): DialogueVoiceAttachment | undefined {
    const assetUrl = normalizeString(value);
    return assetUrl ? { assetUrl } : undefined;
}

function normalizeVoiceVolume(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
