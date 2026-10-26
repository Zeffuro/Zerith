import type { AudioBufferLike, AudioRegion, AudioRegionBatchNamePreset } from '../utils/audioRegions';
import type { SaveAudioRegionInput } from './audioRegionExport';

import { iterateAudioBufferRegionsToWavFiles } from '../utils/audioRegions';
import { exportAssetAudioCuesToProject } from './assetAudioCueExport';
import { assertAudioExportCurrent } from './audioExportOwnership';
import { saveAudioRegionWavToProject } from './audioRegionExport';
import { refreshProjectTree } from './explorerFileActions';
import { refreshReferenceScannerState } from './referenceScanner';

export async function exportAudioCueSheets(projectPath: string, descriptorAssetUrls: string[], visible: boolean, isCurrent: () => boolean) {
    assertAudioExportCurrent(isCurrent);
    if (descriptorAssetUrls.length === 0) return { message: 'No visible cue sheets can be exported.' };
    let exportedCount = 0;
    let failedCount = 0;
    for (const descriptorAssetUrl of descriptorAssetUrls) {
        assertAudioExportCurrent(isCurrent);
        try {
            const result = await exportAssetAudioCuesToProject(projectPath, {
                descriptorAssetUrl, namePreset: 'region-name-time', targetFolder: 'assets/audio-regions',
            }, undefined, isCurrent);
            assertAudioExportCurrent(isCurrent);
            exportedCount += result.exportedCount;
        } catch (error) {
            assertAudioExportCurrent(isCurrent);
            if (!visible) throw error;
            console.error('Failed to export audiosheet cues:', descriptorAssetUrl, error);
            failedCount++;
        }
    }
    if (exportedCount > 0) await refreshAudioExportProject(isCurrent);
    return { message: visible ? [
        `Saved ${exportedCount} cue WAV${exportedCount === 1 ? '' : 's'} from ${descriptorAssetUrls.length - failedCount} sheet${descriptorAssetUrls.length - failedCount === 1 ? '' : 's'}.`,
        failedCount > 0 ? `${failedCount} sheet${failedCount === 1 ? '' : 's'} failed.` : undefined,
    ].filter(Boolean).join(' ') : `Saved ${exportedCount} cue WAV${exportedCount === 1 ? '' : 's'} to assets/audio-regions.` };
}

export async function refreshAudioExportProject(isCurrent: () => boolean): Promise<void> {
    assertAudioExportCurrent(isCurrent);
    await refreshProjectTree(isCurrent);
    assertAudioExportCurrent(isCurrent);
    await refreshReferenceScannerState(isCurrent);
    assertAudioExportCurrent(isCurrent);
}

export async function saveAudioCueBatch(
    projectPath: string,
    audioBuffer: AudioBufferLike,
    sourcePath: string,
    regions: AudioRegion[],
    options: { namePreset: AudioRegionBatchNamePreset; targetFolder: string },
    isCurrent: () => boolean,
) {
    assertAudioExportCurrent(isCurrent);
    let savedCount = 0;
    for (const entry of iterateAudioBufferRegionsToWavFiles(audioBuffer, sourcePath, regions, options)) {
        assertAudioExportCurrent(isCurrent);
        await saveAudioRegionWavToProject(projectPath, {
            ...options,
            region: { end: entry.region.end, ...(entry.regionName === undefined ? {} : { name: entry.regionName }), start: entry.region.start },
            sourcePath,
            wavBytes: entry.wavBytes,
        }, undefined, isCurrent);
        assertAudioExportCurrent(isCurrent);
        savedCount++;
    }
    await refreshAudioExportProject(isCurrent);
    return { message: `Saved ${savedCount} cue WAV${savedCount === 1 ? '' : 's'} to ${options.targetFolder.trim() || 'assets/audio-regions'}.` };
}

export async function saveAudioSelection(projectPath: string, input: SaveAudioRegionInput, isCurrent: () => boolean) {
    assertAudioExportCurrent(isCurrent);
    const result = await saveAudioRegionWavToProject(projectPath, input, undefined, isCurrent);
    await refreshAudioExportProject(isCurrent);
    return { ...result, message: `Saved ${result.assetUrl}${result.collisionResolved ? ' (renamed)' : ''}.` };
}
