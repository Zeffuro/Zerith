import { executeConsoleMessageAction } from '../store/actions/consoleMessageActions';
import { useConsoleStore } from '../store/useConsoleStore';

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
        executeConsoleMessageAction(resolveSource(arguments_), 'log', ...arguments_);
    };

    console.info = (...arguments_: unknown[]) => {
        originalMethods.info(...arguments_);
        executeConsoleMessageAction(resolveSource(arguments_), 'info', ...arguments_);
    };

    console.warn = (...arguments_: unknown[]) => {
        originalMethods.warn(...arguments_);
        executeConsoleMessageAction(resolveSource(arguments_), 'warn', ...arguments_);
    };

    console.error = (...arguments_: unknown[]) => {
        originalMethods.error(...arguments_);
        executeConsoleMessageAction(resolveSource(arguments_), 'error', ...arguments_);
    };

    return () => {
        console.log = originalMethods.log;
        console.info = originalMethods.info;
        console.warn = originalMethods.warn;
        console.error = originalMethods.error;
    };
}

function isCoreLoggerMessage(arguments_: unknown[]): boolean {
    const [first] = arguments_;
    if (typeof first !== 'string') {
        return false;
    }

    return first.startsWith('%c[') && first.includes(']%c');
}

function resolveSource(arguments_: unknown[]): 'editor' | 'preview' {
    const { previewLogCaptureEnabled } = useConsoleStore.getState();
    if (!previewLogCaptureEnabled) {
        return 'editor';
    }

    return isCoreLoggerMessage(arguments_) ? 'preview' : 'editor';
}

