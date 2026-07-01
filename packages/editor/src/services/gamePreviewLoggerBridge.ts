import { Logger } from 'zerith-core';

import { executeConsoleMessageAction } from '../store/actions/consoleMessageActions';

class GamePreviewLogger extends Logger {
    constructor() {
        super('[GamePreview]');
    }

    public override error(message: string, ...arguments_: unknown[]): void {
        executeConsoleMessageAction('preview', 'error', message, ...arguments_);
    }

    public override info(message: string, ...arguments_: unknown[]): void {
        executeConsoleMessageAction('preview', 'info', message, ...arguments_);
    }

    public override warn(message: string, ...arguments_: unknown[]): void {
        executeConsoleMessageAction('preview', 'warn', message, ...arguments_);
    }
}

export function createGamePreviewLogger(): Logger {
    return new GamePreviewLogger();
}

