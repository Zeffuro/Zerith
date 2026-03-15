export interface AudioCue {
    duration?: number;
    loop?: boolean;
    start: number;
    volume?: number;
}

export interface AudiosheetDescriptor {
    cues: Record<string, AudioCue>;
    meta?: Record<string, unknown>;
    source: string;
}
