import type { ConsoleMessage } from '../useConsoleStore';
import { useConsoleStore } from '../useConsoleStore';

export function executeConsoleMessageAction(
    source: ConsoleMessage['source'],
    type: ConsoleMessage['type'],
    ...args: unknown[]
): void {
    useConsoleStore.getState().addMessage(source, type, ...args);
}

