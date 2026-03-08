import type { ConsoleMessage, ConsoleMessagesSlice, ConsoleSet } from '../types';

let nextId = 0;

export function createConsoleMessagesSlice(set: ConsoleSet): ConsoleMessagesSlice {
    return {
        addMessage: (source, type, ...arguments_) =>
            set((state) => {
                const text = formatArguments(arguments_);
                const newMessage: ConsoleMessage = {
                    id: nextId++,
                    source,
                    text,
                    timestamp: new Date(),
                    type,
                };
                return { messages: [...state.messages, newMessage].slice(-1000) };
            }),
        clear: () => set({ messages: [] }),
        messages: [],
    };
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

