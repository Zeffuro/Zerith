import type { WorkbenchResourceKind } from '../../store/workbench/types';

import { normalizePathForComparison } from '../../utils/pathComparison';
import { isRecord } from '../../utils/typeGuards';

export const DRAFT_STORAGE_KEY = 'zerith-recovery-v1';
export const MAX_DRAFT_BYTES = 4 * 1024 * 1024;
export const MAX_DRAFT_FILES = 100;
export const MAX_DRAFT_PROJECTS = 12;

export type DraftStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type RecoveryDraft = { files: RecoveryFile[]; id: string; projectPath: string; updatedAt: number };
export type RecoveryFile = {
    kind: WorkbenchResourceKind;
    path: string;
    savedText: string;
    text: string;
    title: string;
};
const kinds = new Set(['audiosheet', 'characters', 'engineConfig', 'items', 'json', 'localization', 'macros', 'manifest', 'script', 'spritesheet', 'text']);

export function isRecoveryPath(projectPath: string, path: string): boolean {
    const root = recoveryIdentity(projectPath);
    const file = recoveryIdentity(path);
    return file.startsWith(`${root}/`) && !file.slice(root.length + 1).split('/').some(part => ['', '.', '..'].includes(part));
}

export function readDrafts(storage: DraftStorage): RecoveryDraft[] {
    const raw = storage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.drafts)) throw new Error('Saved recovery data could not be read. It has been kept for review.');
    const drafts: RecoveryDraft[] = [];
    for (const entry of value.drafts) {
        if (!isRecord(entry) || typeof entry.projectPath !== 'string' || !entry.projectPath || typeof entry.updatedAt !== 'number' || !Number.isFinite(entry.updatedAt) || !Array.isArray(entry.files)) continue;
        const files: RecoveryFile[] = [];
        for (const file of entry.files) {
            if (!isRecord(file) || typeof file.path !== 'string' || !isRecoveryPath(entry.projectPath, file.path)
                || typeof file.kind !== 'string' || !kinds.has(file.kind) || typeof file.title !== 'string'
                || typeof file.text !== 'string' || typeof file.savedText !== 'string') continue;
            const path = file.path;
            if (files.some(previous => recoveryIdentity(previous.path) === recoveryIdentity(path))) continue;
            files.push({ kind: file.kind as WorkbenchResourceKind, path: file.path, savedText: file.savedText, text: file.text, title: file.title });
        }
        const id = typeof entry.id === 'string' ? entry.id : `legacy:${recoveryIdentity(entry.projectPath)}`;
        if (files.length > 0) drafts.push({ files, id, projectPath: entry.projectPath, updatedAt: entry.updatedAt });
    }
    return drafts;
}

export function recoveryIdentity(path: string): string {
    return normalizePathForComparison(path);
}

export function replaceDraft(storage: DraftStorage, projectPath: string, files: RecoveryFile[], id?: string): void {
    const previous = readDrafts(storage);
    const others = previous.filter(draft => recoveryIdentity(draft.projectPath) !== recoveryIdentity(projectPath) || (id !== undefined && draft.id !== id));
    const next = files.length > 0 ? [...others, { files, id: id ?? `legacy:${recoveryIdentity(projectPath)}`, projectPath, updatedAt: Date.now() }] : others;
    const text = JSON.stringify({ drafts: next, version: 1 });
    if (files.length > MAX_DRAFT_FILES || next.length > MAX_DRAFT_PROJECTS || new TextEncoder().encode(text).length > MAX_DRAFT_BYTES) {
        throw new Error('Recovery storage is full. Save your work or discard older recovery drafts to keep new edits protected.');
    }
    storage.setItem(DRAFT_STORAGE_KEY, text);
}
