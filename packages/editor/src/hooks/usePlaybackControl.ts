import type { Engine, Script } from 'core';
import type { RefObject } from 'react';

import { useEffect } from 'react';

type WritableReference<T> = { current: T };

export async function startPreviewPlayback(
    engine: Engine,
    script: Script,
    playFromIndex: number | undefined,
    requestId: number,
    getLatestRequestId: () => number,
): Promise<void> {
    const requestedIndex = typeof playFromIndex === 'number' ? playFromIndex : 0;
    const startIndex = Math.min(Math.max(0, requestedIndex), Math.max(0, script.length - 1));

    engine.flow.stop();
    engine.clear();
    const sceneManager = engine.scenes;
    sceneManager.addScene('preview', script);
    await sceneManager.jumpToScene('preview', startIndex);

    if (requestId !== getLatestRequestId()) {
        return;
    }

    engine.start();
}

export function usePlaybackControl({
    containerReference,
    engineReference,
    pauseTrigger,
    playbackRequestIdRef,
    playFromIndex,
    playTrigger,
    resumeTrigger,
    scriptRef,
    stepTrigger,
    stopTrigger,
}: {
    containerReference: RefObject<HTMLDivElement | null>;
    engineReference: WritableReference<Engine | undefined>;
    pauseTrigger: number;
    playbackRequestIdRef: WritableReference<number>;
    playFromIndex: number | undefined;
    playTrigger: number;
    resumeTrigger: number;
    scriptRef: WritableReference<Script>;
    stepTrigger: number;
    stopTrigger: number;
}) {
    useEffect(() => {
        if (engineReference.current && playTrigger > 0) {
            const requestId = ++playbackRequestIdRef.current;
            void startPreviewPlayback(
                engineReference.current,
                scriptRef.current,
                playFromIndex,
                requestId,
                () => playbackRequestIdRef.current,
            );
            containerReference.current?.focus();
        }
    }, [containerReference, engineReference, playbackRequestIdRef, playFromIndex, playTrigger, scriptRef]);

    useEffect(() => {
        if (engineReference.current && stopTrigger > 0) {
            playbackRequestIdRef.current++;
            stopPreviewPlayback(engineReference.current, scriptRef.current);
            containerReference.current?.blur();
        }
    }, [containerReference, engineReference, playbackRequestIdRef, scriptRef, stopTrigger]);

    useEffect(() => {
        if (engineReference.current && pauseTrigger > 0) {
            engineReference.current.pause();
        }
    }, [engineReference, pauseTrigger]);

    useEffect(() => {
        if (engineReference.current && resumeTrigger > 0) {
            engineReference.current.resume();
        }
    }, [engineReference, resumeTrigger]);

    useEffect(() => {
        if (engineReference.current && stepTrigger > 0) {
            engineReference.current.step();
        }
    }, [engineReference, stepTrigger]);
}

function stopPreviewPlayback(engine: Engine, script: Script): void {
    engine.flow.stop();
    engine.clear();
    engine.scenes.addScene('preview', script);
}

