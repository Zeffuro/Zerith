import type { DialogueVoiceAttachment } from './DialogueVoice';

export interface DialogueBacklogEntry {
    backlogVisibility: 'hide' | 'show';
    expressionRef?: string;
    lineId?: string;
    namespace?: string;
    path: number[];
    sceneName?: string;
    speaker: string;
    tags: string[];
    text: string;
    voice?: DialogueVoiceAttachment;
}
