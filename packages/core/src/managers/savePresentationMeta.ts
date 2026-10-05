import type { SystemState } from '../types';
import type { SaveMeta } from './SaveManager';

const SAVE_PREVIEW_MAX_LENGTH = 120;
const SAVE_THUMBNAIL_MAX_LENGTH = 300_000;
const SAVE_THUMBNAIL_PATTERN = /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i;

export function buildSavePreviewMeta(dialogue: SystemState['dialogue'] | undefined): Pick<SaveMeta, 'previewSpeaker' | 'previewText'> {
    if (!dialogue) return {};
    const previewSpeaker = normalizePreview(dialogue.speaker);
    const text = normalizePreview(dialogue.text.replaceAll(/{[^}]+}/g, '').replaceAll(/<[^>]+>/g, ''));
    const previewText = text && text.length > SAVE_PREVIEW_MAX_LENGTH
        ? `${text.slice(0, SAVE_PREVIEW_MAX_LENGTH - 3).trimEnd()}...` : text;
    return { ...(previewSpeaker ? { previewSpeaker } : {}), ...(previewText ? { previewText } : {}) };
}

export function buildSaveThumbnailMeta(thumbnailDataUrl: string | undefined): Pick<SaveMeta, 'thumbnailDataUrl'> {
    return isSaveThumbnailDataUrl(thumbnailDataUrl) ? { thumbnailDataUrl } : {};
}

export function isSaveThumbnailDataUrl(value: unknown): value is string {
    return typeof value === 'string' && value.length <= SAVE_THUMBNAIL_MAX_LENGTH && SAVE_THUMBNAIL_PATTERN.test(value);
}

function normalizePreview(value: string | undefined): string | undefined {
    const normalized = value?.replaceAll(/\s+/g, ' ').trim();
    return normalized && normalized.length > 0 ? normalized : undefined;
}
