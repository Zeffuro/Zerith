export interface ConsoleMessage {
    id: number;
    source: 'editor' | 'engine';
    type: 'log' | 'info' | 'warn' | 'error';
    text: string;
    timestamp: Date;
}

export type ConsoleSet = (
    partial: Record<string, any> | ((state: Record<string, any>) => Record<string, any>)
) => void;

export interface ConsoleMessagesSlice {
    messages: ConsoleMessage[];
    addMessage: (
        source: ConsoleMessage['source'],
        type: ConsoleMessage['type'],
        ...args: any[]
    ) => void;
    clear: () => void;
}

export interface ConsoleState extends ConsoleMessagesSlice {}

