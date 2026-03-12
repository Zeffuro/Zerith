import type { ConsoleMessage, ConsoleMessageInput } from '../useConsoleStore';

import { useConsoleStore } from '../useConsoleStore';

export function executeConsoleMessageAction(
    source: ConsoleMessage['source'],
    type: ConsoleMessage['type'],
    ...arguments_: unknown[]
): void {
    useConsoleStore.getState().addMessage(source, type, ...arguments_);
}

export function executeConsoleMessageBatchAction(entries: ConsoleMessageInput[]): void {
    useConsoleStore.getState().addMessagesBatch(entries);
}

