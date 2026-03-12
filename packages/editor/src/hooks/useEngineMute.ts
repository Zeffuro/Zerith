import type { Engine } from 'core';

import { useEffect } from 'react';

type WritableReference<T> = { current: T };

export function useEngineMute({
    engineReferenceRef,
    isMuted,
}: {
    engineReferenceRef: WritableReference<Engine | undefined>;
    isMuted: boolean;
}) {
    useEffect(() => {
        if (engineReferenceRef.current) {
            engineReferenceRef.current.audio.muted = isMuted;
        }
    }, [engineReferenceRef, isMuted]);
}

