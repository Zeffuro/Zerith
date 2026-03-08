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

function formatArguments(arguments_: any[]): string {
    const cleaned = [...arguments_];

    if (typeof cleaned[0] === 'string' && cleaned[0].includes('%c')) {
        cleaned[0] = cleaned[0].replaceAll('%c', '');
        while (typeof cleaned[1] === 'string' && /[:;]/.test(cleaned[1])) {
            cleaned.splice(1, 1);
        }
    }

    return cleaned
        .map((argument) => (typeof argument === 'object' ? safeJson(argument) : String(argument)))
        .join(' ');
}

function safeJson(v: any) {
    try {
        return JSON.stringify(v);
    } catch {
        return String(v);
    }
}

