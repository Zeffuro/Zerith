import { fsReadBinaryFile } from '../services/fs';

export type AudioContextReference = { current: AudioContext | undefined };

export async function closeAudioContext(reference: AudioContextReference): Promise<void> {
    if (!reference.current) return;
    const context = reference.current;
    reference.current = undefined;
    await context.close();
}

export function computeAudioPeaks(channelData: Float32Array, bins: number): number[] {
    if (channelData.length === 0 || bins <= 0) return [];
    const samplesPerBin = Math.max(1, Math.floor(channelData.length / bins));
    const peaks = Array.from({ length: bins }, (_, index) => {
        const start = index * samplesPerBin;
        const end = index === bins - 1 ? channelData.length : start + samplesPerBin;
        let max = 0;
        for (let pointer = start; pointer < end; pointer += 1) max = Math.max(max, Math.abs(channelData[pointer] ?? 0));
        return max;
    });
    const maxPeak = Math.max(...peaks, 0.0001);
    return peaks.map((peak) => peak / maxPeak);
}

export async function decodeAudioSource(path: string, reference: AudioContextReference): Promise<AudioBuffer> {
    const bytes = await loadAudioBytes(path);
    return getAudioContext(reference).decodeAudioData(bytes);
}

export function getAudioContext(reference: AudioContextReference): AudioContext {
    if (!reference.current) reference.current = new AudioContext();
    return reference.current;
}

export async function loadAudioBytes(path: string): Promise<ArrayBuffer> {
    if (/^(?:https?:|data:|blob:|file:|asset:)/.test(path)) {
        const response = await fetch(path);
        return response.arrayBuffer();
    }
    const bytes = await fsReadBinaryFile(path);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
