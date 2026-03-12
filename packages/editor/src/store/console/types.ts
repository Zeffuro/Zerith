export interface ConsoleMessage {
    id: number;
    source: 'editor' | 'preview' | 'react';
    text: string;
    timestampText: string;
    type: 'error' | 'info' | 'log' | 'warn';
}

export type ConsoleMessageInput = {
    arguments_: unknown[];
    source: ConsoleMessage['source'];
    type: ConsoleMessage['type'];
};

export interface ConsoleMessagesSlice {
    addMessage: (
        source: ConsoleMessage['source'],
        type: ConsoleMessage['type'],
        ...arguments_: unknown[]
    ) => void;
    addMessagesBatch: (entries: ConsoleMessageInput[]) => void;
    clear: () => void;
    messages: ConsoleMessage[];
    previewLogCaptureEnabled: boolean;
    setPreviewLogCaptureEnabled: (enabled: boolean) => void;
}

export type ConsoleSet = (
    partial: ((state: ConsoleState) => Partial<ConsoleState>) | Partial<ConsoleState>
) => void;

export type ConsoleState = ConsoleMessagesSlice;

