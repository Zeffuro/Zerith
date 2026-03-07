import { create } from 'zustand';

export interface ConsoleMessage {
    id: number;
    source: 'editor' | 'engine';
    type: 'log' | 'info' | 'warn' | 'error';
    text: string;
    timestamp: Date;
}

interface ConsoleState {
    messages: ConsoleMessage[];
    addMessage: (
        source: ConsoleMessage['source'],
        type: ConsoleMessage['type'],
        ...args: any[]
    ) => void;
    clear: () => void;
}

let nextId = 0;

function formatArgs(args: any[]): string {
    const cleaned = [...args];

    if (typeof cleaned[0] === 'string' && cleaned[0].includes('%c')) {
        cleaned[0] = cleaned[0].replace(/%c/g, '');
        while (typeof cleaned[1] === 'string' && /[:;]/.test(cleaned[1])) {
            cleaned.splice(1, 1);
        }
    }

    return cleaned
        .map((arg) => (typeof arg === 'object' ? safeJson(arg) : String(arg)))
        .join(' ');
}

function safeJson(v: any) {
    try { return JSON.stringify(v); } catch { return String(v); }
}

export const useConsoleStore = create<ConsoleState>((set) => ({
    messages: [],
    addMessage: (source, type, ...args) =>
        set((state) => {
            const text = formatArgs(args);
            const newMsg: ConsoleMessage = {
                id: nextId++,
                source,
                type,
                text,
                timestamp: new Date(),
            };
            return { messages: [...state.messages, newMsg].slice(-1000) };
        }),
    clear: () => set({ messages: [] }),
}));