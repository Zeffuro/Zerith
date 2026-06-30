export interface DialogueVoiceAttachment {
    assetUrl: string;
    cue?: string;
    volume?: number;
}

export type DialogueVoiceReference = DialogueVoiceAttachment | string;
