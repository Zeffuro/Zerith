import type { SheetDescriptorBase, SpritesheetDescriptor } from './SpritesheetDescriptor';

export interface AudioCue {
    duration?: number;
    loop?: boolean;
    start: number;
    volume?: number;
}

export interface AudiosheetDescriptor extends SheetDescriptorBase {
    cues: Record<string, AudioCue>;
}

export type SheetDescriptor = AudiosheetDescriptor | SpritesheetDescriptor;

