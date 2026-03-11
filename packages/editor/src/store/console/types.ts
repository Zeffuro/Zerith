export interface ConsoleMessage {
    id: number;
    source: 'editor' | 'preview';
    text: string;
    timestamp: Date;
    type: 'error' | 'info' | 'log' | 'warn';
}

export interface ConsoleMessagesSlice {
    addMessage: (
        source: ConsoleMessage['source'],
        type: ConsoleMessage['type'],
        ...arguments_: unknown[]
    ) => void;
    clear: () => void;
    messages: ConsoleMessage[];
    previewLogCaptureEnabled: boolean;
    setPreviewLogCaptureEnabled: (enabled: boolean) => void;
}

export type ConsoleSet = (
    partial: ((state: ConsoleState) => Partial<ConsoleState>) | Partial<ConsoleState>
) => void;

export type ConsoleState = ConsoleMessagesSlice;

