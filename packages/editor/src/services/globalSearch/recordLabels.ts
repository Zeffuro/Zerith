export const CHARACTER_LABEL_PREFIX = 'Character';
export const ITEM_LABEL_PREFIX = 'Item';

export type RecordLabelKind = 'character' | 'item';

export function resolveRecordLabelPrefix(kind: RecordLabelKind): string {
	return kind === 'character' ? CHARACTER_LABEL_PREFIX : ITEM_LABEL_PREFIX;
}

export function formatRecordLabel(labelPrefix: string, entryName: string): string {
	return `${labelPrefix}: ${entryName}`;
}

export function formatRecordSourceLabel(kind: RecordLabelKind, entryName: string): string {
	return formatRecordLabel(resolveRecordLabelPrefix(kind), entryName);
}

