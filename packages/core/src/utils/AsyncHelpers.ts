import type { IEventBus } from '../interfaces/managers';
import type { EngineEventMap } from '../interfaces/managers/IEventBus';

export async function waitForAbortableDelay(ms: number, signal: AbortSignal): Promise<void> {
    if (signal.aborted || ms <= 0) {
        return;
    }

    await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, ms);

        const onAbort = () => {
            clearTimeout(timeout);
            resolve();
        };

        signal.addEventListener('abort', onAbort, { once: true });
    });
}

export async function waitForEventsOrAbort<K extends keyof EngineEventMap>(
    events: IEventBus,
    eventNames: K[],
    signal: AbortSignal,
): Promise<void> {
    if (signal.aborted) {
        return;
    }

    await new Promise<void>((resolve) => {
        let resolved = false;

        const cleanup = () => {
            for (const eventName of eventNames) {
                events.off(eventName, onEvent);
            }
            signal.removeEventListener('abort', onAbort);
        };

        const finish = () => {
            if (resolved) {
                return;
            }

            resolved = true;
            cleanup();
            resolve();
        };

        const onEvent = () => {
            finish();
        };

        const onAbort = () => {
            finish();
        };

        for (const eventName of eventNames) {
            events.on(eventName, onEvent);
        }
        signal.addEventListener('abort', onAbort, { once: true });
    });
}

