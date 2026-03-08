import { create } from 'zustand';

import type { ConsoleState } from './console/types';

import { createConsoleMessagesSlice } from './console/slices/messagesSlice';

export type { ConsoleMessage } from './console/types';

export const useConsoleStore = create<ConsoleState>((set) => ({
    ...createConsoleMessagesSlice(set),
}));