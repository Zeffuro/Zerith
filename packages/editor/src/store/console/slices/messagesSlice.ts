import type { ConsoleMessage, ConsoleMessageInput, ConsoleMessagesSlice, ConsoleSet } from '../types';

const MAX_CONSOLE_MESSAGES = 1000;
let nextId = 0;

export function createConsoleMessagesSlice(set: ConsoleSet): ConsoleMessagesSlice {
    return {
        addMessage: (source, type, ...arguments_) =>
            set((state) => appendMessages(state.messages, [{ arguments_, source, type }])),
        addMessagesBatch: (entries) =>
            set((state) => appendMessages(state.messages, entries)),
        clear: () => set({ messages: [] }),
        messages: [],
        previewLogCaptureEnabled: false,
        setPreviewLogCaptureEnabled: (enabled) => set({ previewLogCaptureEnabled: enabled }),
    };
}

function appendMessages(current: ConsoleMessage[], entries: ConsoleMessageInput[]): { messages: ConsoleMessage[] } {
    if (entries.length === 0) return { messages: current };

    const next = entries.map((entry) => toConsoleMessage(entry));
    return { messages: [...current, ...next].slice(-MAX_CONSOLE_MESSAGES) };
}

function formatArgument(argument: unknown): string {
    if (argument == undefined) return String(argument);
    if (argument instanceof Error) return argument.message;

    switch (typeof argument) {
        case 'bigint':
        case 'boolean':
        case 'number':
        case 'string':
        case 'symbol': {
            return String(argument);
        }
        default: {
            return safeJson(argument);
        }
    }
}

function formatArguments(arguments_: unknown[]): string {
    const cleaned = [...arguments_];

    if (typeof cleaned[0] === 'string' && cleaned[0].includes('%c')) {
        cleaned[0] = cleaned[0].replaceAll('%c', '');
        while (typeof cleaned[1] === 'string' && /[:;]/.test(cleaned[1])) {
            cleaned.splice(1, 1);
        }
    }

    return cleaned
        .map((argument) => formatArgument(argument))
        .join(' ');
}

function safeJson(value: unknown): string {
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function toConsoleMessage(entry: ConsoleMessageInput): ConsoleMessage {
    const timestamp = new Date();

    return {
        id: nextId++,
        source: entry.source,
        text: formatArguments(entry.arguments_),
        timestampText: timestamp.toLocaleTimeString(),
        type: entry.type,
    };
}


