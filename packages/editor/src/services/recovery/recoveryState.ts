import { create } from 'zustand';

import type { RecoveryDraft, RecoveryFile } from './draftStorage';

export type RecoveryOffer = { draftId: string; files: RecoveryPreview[]; generation: number; projectPath: string };
export type RecoveryPreview = { diskError?: string; diskText?: string } & RecoveryFile;
export const useRecoveryStore = create<{
    drafts: RecoveryDraft[];
    error?: string;
    offer?: RecoveryOffer;
    startupVisible: boolean;
}>(() => ({ drafts: [], startupVisible: true }));
