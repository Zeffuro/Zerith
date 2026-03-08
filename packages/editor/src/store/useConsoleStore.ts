import { create } from 'zustand';
import { createConsoleMessagesSlice } from './console/slices/messagesSlice';
import type { ConsoleState } from './console/types';

export type { ConsoleMessage } from './console/types';

export const useConsoleStore = create<ConsoleState>((set) => ({
    ...createConsoleMessagesSlice(set),
}));