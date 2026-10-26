export class AudioExportRetiredError extends Error {
    constructor() {
        super('Audio export is no longer current. Completed files have been retained.');
        this.name = 'AudioExportRetiredError';
    }
}

export function assertAudioExportCurrent(isCurrent: () => boolean = () => true): void {
    if (!isCurrent()) throw new AudioExportRetiredError();
}

export async function runAudioExportStep<T>(isCurrent: () => boolean, operation: () => Promise<T>): Promise<T> {
    assertAudioExportCurrent(isCurrent);
    try {
        const result = await operation();
        assertAudioExportCurrent(isCurrent);
        return result;
    } catch (error) {
        assertAudioExportCurrent(isCurrent);
        throw error;
    }
}
