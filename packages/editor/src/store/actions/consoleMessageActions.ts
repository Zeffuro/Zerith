import type { ConsoleMessage } from '../useConsoleStore';

import { useConsoleStore } from '../useConsoleStore';

export function executeConsoleMessageAction(
    source: ConsoleMessage['source'],
    type: ConsoleMessage['type'],
    ...arguments_: unknown[]
): void {
    useConsoleStore.getState().addMessage(source, type, ...arguments_);
}

