import type { RecordSearchKind } from './contracts';

export const CHARACTER_LABEL_PREFIX = 'Character';
export const ITEM_LABEL_PREFIX = 'Item';

export function resolveRecordLabelPrefix(kind: RecordSearchKind): string {
	return kind === 'character' ? CHARACTER_LABEL_PREFIX : ITEM_LABEL_PREFIX;
}

export function formatRecordLabel(labelPrefix: string, entryName: string): string {
	return `${labelPrefix}: ${entryName}`;
}

export function formatRecordSourceLabel(kind: RecordSearchKind, entryName: string): string {
	return formatRecordLabel(resolveRecordLabelPrefix(kind), entryName);
}

