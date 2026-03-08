export interface ConsoleMessage {
    id: number;
    source: 'editor' | 'engine';
    text: string;
    timestamp: Date;
    type: 'error' | 'info' | 'log' | 'warn';
}

export interface ConsoleMessagesSlice {
    addMessage: (
        source: ConsoleMessage['source'],
        type: ConsoleMessage['type'],
        ...arguments_: any[]
    ) => void;
    clear: () => void;
    messages: ConsoleMessage[];
}

export type ConsoleSet = (
    partial: ((state: Record<string, any>) => Record<string, any>) | Record<string, any>
) => void;

export interface ConsoleState extends ConsoleMessagesSlice {}

