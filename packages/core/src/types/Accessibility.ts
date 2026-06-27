export interface DialogueAnnouncement {
    captions: boolean;
    lineId?: string;
    selfVoicing: boolean;
    speaker: string;
    text: string;
}

export type DialogueAnnouncementHandler = (announcement: DialogueAnnouncement) => Promise<void> | void;
