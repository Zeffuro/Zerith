import { type AudiosheetDescriptor } from '@zeffuro/zerith-core';

import { clamp } from '../../utils/math';
import { computeCueDragUpdate } from './audiosheetEditorModel';

type CueMarker = { end: number; name: string; start: number };

type CueOperationsContext = {
    applyDescriptorUpdate: (next: AudiosheetDescriptor) => void;
    audioDuration: number | undefined;
    cueMarkers: CueMarker[];
    descriptor: AudiosheetDescriptor | undefined;
    selectedCue: string | undefined;
    setScrub: (next: number) => void;
    setSelectedCue: (next: string | undefined) => void;
    setValidationMessage: (next: string | undefined) => void;
    updateCue: (name: string, changes: Partial<AudiosheetDescriptor['cues'][string]>) => void;
};

export function createCueOperations(context: CueOperationsContext): {
    addCueFromSelection: (a: number, b: number) => void;
    applyBoundaryShortcut: (side: 'left' | 'right', targetTimeRaw: number) => void;
    deleteCue: (name: string) => void;
    renameCue: (name: string, nextRaw: string) => void;
} {
    const addCueFromSelection = (a: number, b: number) => {
        if (!context.descriptor) return;
        const start = Math.max(0, Math.min(a, b));
        const duration = Math.max(0.01, Math.abs(a - b));
        const name = generateDefaultCueName(context.descriptor.cues);
        context.applyDescriptorUpdate({ ...context.descriptor, cues: { ...context.descriptor.cues, [name]: { duration, start, volume: 1 } } });
        context.setSelectedCue(name);
        context.setScrub(start);
    };

    const renameCue = (name: string, nextRaw: string) => {
        if (!context.descriptor) return;
        const nextName = nextRaw.trim();
        if (!nextName || nextName === name) return;
        if (context.descriptor.cues[nextName]) return void context.setValidationMessage(`Cue "${nextName}" already exists.`);
        const cues = Object.fromEntries(Object.entries(context.descriptor.cues).map(([key, cue]) => [key === name ? nextName : key, cue]));
        context.applyDescriptorUpdate({ ...context.descriptor, cues });
        context.setSelectedCue(context.selectedCue === name ? nextName : context.selectedCue);
    };

    const deleteCue = (name: string) => {
        if (!context.descriptor?.cues[name]) return;
        const nextCueEntries = Object.entries(context.descriptor.cues).filter(([cueName]) => cueName !== name).toSorted((a, b) => a[1].start - b[1].start);
        const nextCues = Object.fromEntries(nextCueEntries);
        context.applyDescriptorUpdate({ ...context.descriptor, cues: nextCues });
        const fallbackSelection = nextCueEntries[0]?.[0];
        const nextSelection = context.selectedCue === name ? fallbackSelection : context.selectedCue;
        context.setSelectedCue(nextSelection);
        if (nextSelection && nextCues[nextSelection]) context.setScrub(nextCues[nextSelection].start);
    };

    const applyBoundaryShortcut = (side: 'left' | 'right', targetTimeRaw: number) => {
        if (!context.descriptor) return;
        const clipDuration = Math.max(0.01, context.audioDuration ?? (targetTimeRaw + 0.5));
        const targetTime = clamp(targetTimeRaw, 0, clipDuration);
        const orderedByStart = context.cueMarkers.toSorted((a, b) => a.start - b.start);

        if (side === 'left') {
            const targetCue = orderedByStart.filter((cue) => cue.start >= targetTime).toSorted((a, b) => (a.start - targetTime) - (b.start - targetTime))[0]
                ?? orderedByStart.findLast((cue) => cue.start <= targetTime);
            if (targetCue && context.descriptor.cues[targetCue.name]) {
                context.updateCue(targetCue.name, computeCueDragUpdate(context.descriptor.cues[targetCue.name], 'start', targetTime, context.audioDuration));
                context.setSelectedCue(targetCue.name);
                context.setScrub(targetTime);
                return;
            }

            const cueEnd = clamp(targetTime + 0.5, 0.01, clipDuration);
            const cueStart = clamp(targetTime, 0, cueEnd - 0.01);
            const name = generateDefaultCueName(context.descriptor.cues);
            context.applyDescriptorUpdate({
                ...context.descriptor,
                cues: { ...context.descriptor.cues, [name]: { duration: Math.max(0.01, cueEnd - cueStart), start: cueStart, volume: 1 } },
            });
            context.setSelectedCue(name);
            context.setScrub(targetTime);
            return;
        }

        const rightCue = orderedByStart.find((cue) => cue.end >= targetTime);
        if (rightCue && context.descriptor.cues[rightCue.name]) {
            context.updateCue(rightCue.name, computeCueDragUpdate(context.descriptor.cues[rightCue.name], 'end', targetTime, context.audioDuration));
            context.setSelectedCue(rightCue.name);
            context.setScrub(targetTime);
            return;
        }

        const leftCue = orderedByStart.findLast((cue) => cue.start <= targetTime);
        if (leftCue && context.descriptor.cues[leftCue.name]) {
            context.updateCue(leftCue.name, computeCueDragUpdate(context.descriptor.cues[leftCue.name], 'end', targetTime, context.audioDuration));
            context.setSelectedCue(leftCue.name);
            context.setScrub(targetTime);
            return;
        }

        const cueEnd = clamp(targetTime, 0.01, clipDuration);
        const cueStart = clamp(targetTime - 0.5, 0, cueEnd - 0.01);
        const name = generateDefaultCueName(context.descriptor.cues);
        context.applyDescriptorUpdate({
            ...context.descriptor,
            cues: { ...context.descriptor.cues, [name]: { duration: Math.max(0.01, cueEnd - cueStart), start: cueStart, volume: 1 } },
        });
        context.setSelectedCue(name);
        context.setScrub(targetTime);
    };

    return { addCueFromSelection, applyBoundaryShortcut, deleteCue, renameCue };
}

export function generateDefaultCueName(cues: AudiosheetDescriptor['cues']): string {
    let index = Object.keys(cues).length + 1;
    while (cues[`cue_${index}`]) index += 1;
    return `cue_${index}`;
}

