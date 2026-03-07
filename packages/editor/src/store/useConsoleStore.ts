import { create } from 'zustand';

export interface ConsoleMessage {
    id: number;
    type: 'log' | 'info' | 'warn' | 'error';
    text: string;
    timestamp: Date;
}

interface ConsoleState {
    messages: ConsoleMessage[];
    addMessage: (type: ConsoleMessage['type'], ...args: any[]) => void;
    clear: () => void;
}

let nextId = 0;

function formatArgs(args: any[]): string {
    return args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
}

export const useConsoleStore = create<ConsoleState>((set) => ({
    messages:[],
    addMessage: (type, ...args) => set((state) => {
        const text = formatArgs(args);
        const newMsg: ConsoleMessage = { id: nextId++, type, text, timestamp: new Date() };
        return { messages: [...state.messages, newMsg].slice(-500) };
    }),
    clear: () => set({ messages:[] })
}));