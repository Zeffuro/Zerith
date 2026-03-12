import type { ConsoleMessageInput } from '../store/useConsoleStore';

import { executeConsoleMessageBatchAction } from '../store/actions/consoleMessageActions';
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

    let disposed = false;
    let flushTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
    const queuedMessages: ConsoleMessageInput[] = [];

    const flushQueuedMessages = () => {
        flushTimer = undefined;
        if (disposed || queuedMessages.length === 0) return;

        const batch = queuedMessages.splice(0);
        try {
            executeConsoleMessageBatchAction(batch);
        } catch (error: unknown) {
            originalMethods.error('Console interceptor failed to dispatch message batch:', error);
        }
    };

    const enqueueConsoleMessage = (method: ConsoleMethodName, arguments_: unknown[]) => {
        // Defer state writes so React warnings logged during render do not trigger render-phase updates.
        globalThis.queueMicrotask(() => {
            if (disposed) return;

            try {
                queuedMessages.push({
                    arguments_,
                    source: resolveSource(arguments_),
                    type: method,
                });

                if (flushTimer === undefined) {
                    flushTimer = globalThis.setTimeout(flushQueuedMessages, 33);
                }
            } catch (error: unknown) {
                originalMethods.error('Console interceptor failed to dispatch message:', error);
            }
        });
    };

    console.log = (...arguments_: unknown[]) => {
        originalMethods.log(...arguments_);
        enqueueConsoleMessage('log', arguments_);
    };

    console.info = (...arguments_: unknown[]) => {
        originalMethods.info(...arguments_);
        enqueueConsoleMessage('info', arguments_);
    };

    console.warn = (...arguments_: unknown[]) => {
        originalMethods.warn(...arguments_);
        enqueueConsoleMessage('warn', arguments_);
    };

    console.error = (...arguments_: unknown[]) => {
        originalMethods.error(...arguments_);
        enqueueConsoleMessage('error', arguments_);
    };

    return () => {
        disposed = true;
        if (flushTimer !== undefined) {
            globalThis.clearTimeout(flushTimer);
            flushTimer = undefined;
        }
        queuedMessages.length = 0;
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

function isReactConsoleMessage(arguments_: unknown[]): boolean {
    const first = typeof arguments_[0] === 'string' ? arguments_[0] : '';
    const second = typeof arguments_[1] === 'string' ? arguments_[1] : '';

    return first.includes('react-dom')
        || first.includes('React Hook')
        || first.includes('Maximum update depth exceeded')
        || first.includes('Cannot update a component')
        || first.includes('An error occurred in the <App> component')
        || second.includes('react-dom');
}

function resolveSource(arguments_: unknown[]): 'editor' | 'preview' | 'react' {
    if (isReactConsoleMessage(arguments_)) {
        return 'react';
    }

    const { previewLogCaptureEnabled } = useConsoleStore.getState();
    if (!previewLogCaptureEnabled) {
        return 'editor';
    }

    return isCoreLoggerMessage(arguments_) ? 'preview' : 'editor';
}

