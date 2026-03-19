import { fsDirname, fsJoin, fsReadBinaryFile } from '../../services/fs';
import { clamp } from '../../utils/math';

export type AudiosheetPlaybackReferences = {
    contextReference: { current: AudioContext | undefined };
    frameReference: { current: number | undefined };
    playEndReference: { current: number | undefined };
    playOffsetReference: { current: number };
    playStartReference: { current: number };
    sourceReference: { current: AudioBufferSourceNode | undefined };
};

export type AudiosheetPlaybackSetters = {
    setIsPlaying: (value: boolean) => void;
    setScrub: (value: number) => void;
};

export async function decodeAudiosheetSource(
    descriptorPath: string,
    source: string,
    references: AudiosheetPlaybackReferences,
): Promise<{ audioBuffer: AudioBuffer; sourcePath: string }> {
    const sourcePath = await resolveAudioPath(descriptorPath, source);
    const bytes = await loadAudioBytes(sourcePath);
    const audioBuffer = await getAudioContext(references.contextReference).decodeAudioData(bytes);
    return { audioBuffer, sourcePath };
}

export function getAudioContext(reference: AudiosheetPlaybackReferences['contextReference']): AudioContext {
    if (!reference.current) reference.current = new AudioContext();
    return reference.current;
}

export async function loadAudioBytes(path: string): Promise<ArrayBuffer> {
    if (/^(?:https?:|data:|blob:|file:)/.test(path)) {
        const response = await fetch(path);
        return response.arrayBuffer();
    }
    const bytes = await fsReadBinaryFile(path);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function pauseAudiosheetPlayback(
    isPlaying: boolean,
    audioBuffer: AudioBuffer | undefined,
    references: AudiosheetPlaybackReferences,
    setters: AudiosheetPlaybackSetters,
): void {
    if (isPlaying && references.contextReference.current && audioBuffer) {
        const elapsed = references.contextReference.current.currentTime - references.playStartReference.current;
        setters.setScrub(clamp(references.playOffsetReference.current + elapsed, 0, audioBuffer.duration));
    }
    stopAudiosheetPlayback(references, setters);
}

export async function playAudiosheetRange(
    audioBuffer: AudioBuffer,
    from: number,
    to: number | undefined,
    references: AudiosheetPlaybackReferences,
    setters: AudiosheetPlaybackSetters,
): Promise<void> {
    const context = getAudioContext(references.contextReference);
    if (context.state === 'suspended') await context.resume();

    stopAudiosheetPlayback(references, setters);
    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);

    references.sourceReference.current = source;
    references.playStartReference.current = context.currentTime;
    references.playOffsetReference.current = clamp(from, 0, audioBuffer.duration);
    references.playEndReference.current = to;

    source.addEventListener('ended', () => {
        const endedAt = references.playEndReference.current;
        stopAudiosheetPlayback(references, setters);
        if (endedAt !== undefined) setters.setScrub(endedAt);
    });

    const clipDuration = to === undefined ? undefined : Math.max(0, to - references.playOffsetReference.current);
    source.start(0, references.playOffsetReference.current, clipDuration);
    setters.setIsPlaying(true);

    const sync = () => {
        if (!references.sourceReference.current) return;
        const elapsed = context.currentTime - references.playStartReference.current;
        const next = references.playOffsetReference.current + elapsed;
        setters.setScrub(references.playEndReference.current === undefined ? next : Math.min(next, references.playEndReference.current));
        references.frameReference.current = requestAnimationFrame(sync);
    };
    references.frameReference.current = requestAnimationFrame(sync);
}

export async function resolveAudioPath(descriptorPath: string, source: string): Promise<string> {
    if (/^(?:https?:|data:|blob:|file:)/.test(source)) return source;
    if (/^[A-Za-z]:[\\/]/.test(source) || source.startsWith('/')) return source;
    const parent = await fsDirname(descriptorPath);
    return fsJoin(parent, source);
}

export function stopAudiosheetPlayback(references: AudiosheetPlaybackReferences, setters: AudiosheetPlaybackSetters): void {
    if (references.sourceReference.current) {
        try {
            references.sourceReference.current.stop();
        } catch {
            // Ignore stop() on already-ended nodes.
        }
        references.sourceReference.current.disconnect();
        references.sourceReference.current = undefined;
    }

    if (references.frameReference.current !== undefined) cancelAnimationFrame(references.frameReference.current);
    references.frameReference.current = undefined;
    references.playEndReference.current = undefined;
    setters.setIsPlaying(false);
}

