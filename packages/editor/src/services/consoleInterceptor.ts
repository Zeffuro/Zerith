import { executeConsoleMessageAction } from '../store/actions/consoleMessageActions';

type ConsoleMethod = (...arguments_: unknown[]) => void;

type ConsoleMethodMap = {
    [key in ConsoleMethodName]: ConsoleMethod;
};

type ConsoleMethodName = 'error' | 'info' | 'log' | 'warn';

export function setupConsoleInterceptor(): () => void {
    const originalMethods: ConsoleMethodMap = {
        error: console.error.bind(console),
        info: console.info.bind(console),
        log: console.log.bind(console),
        warn: console.warn.bind(console),
    };

    console.log = (...arguments_: unknown[]) => {
        originalMethods.log(...arguments_);
        executeConsoleMessageAction('editor', 'log', ...arguments_);
    };

    console.info = (...arguments_: unknown[]) => {
        originalMethods.info(...arguments_);
        executeConsoleMessageAction('editor', 'info', ...arguments_);
    };

    console.warn = (...arguments_: unknown[]) => {
        originalMethods.warn(...arguments_);
        executeConsoleMessageAction('editor', 'warn', ...arguments_);
    };

    console.error = (...arguments_: unknown[]) => {
        originalMethods.error(...arguments_);
        executeConsoleMessageAction('editor', 'error', ...arguments_);
    };

    return () => {
        console.log = originalMethods.log;
        console.info = originalMethods.info;
        console.warn = originalMethods.warn;
        console.error = originalMethods.error;
    };
}

