import type { AudioRegion, AudioRegionBatchNamePreset } from '../utils/audioRegions';

import { createAudioRegionBatchExportPlan } from '../utils/audioRegions';
import { assertAudioExportCurrent, runAudioExportStep } from './audioExportOwnership';
import {
    fsJoin,
    fsMkdir,
    fsReadDirectory,
    fsWriteBinaryFileExclusive,
} from './fs';

export type SaveAudioRegionDependencies = {
    join: (...parts: string[]) => Promise<string>;
    mkdir: (path: string, recursive?: boolean, isCurrent?: () => boolean) => Promise<void>;
    readDirectory: (path: string) => Promise<readonly { name: string }[]>;
    writeBinaryFileExclusive: (path: string, content: Uint8Array, isCurrent?: () => boolean) => Promise<void>;
};

export type SaveAudioRegionInput = {
    namePreset?: AudioRegionBatchNamePreset;
    region: AudioRegion;
    sourcePath: string;
    targetFolder?: string;
    wavBytes: Uint8Array;
};

export type SaveAudioRegionResult = {
    assetUrl: string;
    collisionResolved: boolean;
    targetName: string;
    targetPath: string;
};

const DEFAULT_AUDIO_REGION_TARGET_FOLDER = 'assets/audio-regions';
const MAX_CREATION_ATTEMPTS = 32;

const DEFAULT_SAVE_AUDIO_REGION_DEPENDENCIES: SaveAudioRegionDependencies = {
    join: fsJoin,
    mkdir: fsMkdir,
    readDirectory: fsReadDirectory,
    writeBinaryFileExclusive: fsWriteBinaryFileExclusive,
};

export async function saveAudioRegionWavToProject(
    projectPath: string,
    input: SaveAudioRegionInput,
    dependencies: SaveAudioRegionDependencies = DEFAULT_SAVE_AUDIO_REGION_DEPENDENCIES,
    isCurrent: () => boolean = () => true,
): Promise<SaveAudioRegionResult> {
    assertAudioExportCurrent(isCurrent);
    if (!projectPath) {
        throw new Error('Cannot save audio selection without an open project.');
    }

    const targetFolder = normalizeTargetFolder(input.targetFolder ?? DEFAULT_AUDIO_REGION_TARGET_FOLDER);
    const targetDirectory = await runAudioExportStep(isCurrent, () => dependencies.join(projectPath, targetFolder));
    await runAudioExportStep(isCurrent, () => dependencies.mkdir(targetDirectory, true, isCurrent));

    const existingEntries = await runAudioExportStep(isCurrent, () => dependencies.readDirectory(targetDirectory));
    const occupiedNames = new Set(existingEntries.map((entry) => entry.name));
    for (let attempt = 1; ; attempt += 1) {
        assertAudioExportCurrent(isCurrent);
        const [plannedExport] = createAudioRegionBatchExportPlan(input.sourcePath, [input.region], {
            existingFileNames: occupiedNames,
            namePreset: input.namePreset,
        });
        if (plannedExport === undefined) {
            throw new Error('Cannot save audio selection without a selected region.');
        }
        const targetName = plannedExport.fileName;
        const targetPath = await runAudioExportStep(isCurrent, () => dependencies.join(targetDirectory, targetName));
        try {
            await runAudioExportStep(isCurrent, () => dependencies.writeBinaryFileExclusive(targetPath, input.wavBytes, isCurrent));
        } catch (error) {
            assertAudioExportCurrent(isCurrent);
            if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 'alreadyExists') throw error;
            if (attempt === MAX_CREATION_ATTEMPTS) {
                throw new Error(`Could not create a WAV after ${MAX_CREATION_ATTEMPTS} filename collisions in ${targetDirectory}. Try exporting again.`, { cause: error });
            }
            occupiedNames.add(targetName);
            continue;
        }
        return {
            assetUrl: `/${targetFolder}/${targetName}`,
            collisionResolved: plannedExport.collisionResolved,
            targetName,
            targetPath,
        };
    }
}

function normalizeTargetFolder(folder: string): string {
    const normalized = folder.replaceAll('\\', '/').replaceAll(/^\/+|\/+$/gu, '') || DEFAULT_AUDIO_REGION_TARGET_FOLDER;
    const segments = normalized.split('/').filter((segment) => segment.length > 0);
    if (
        segments.length === 0
        || segments[0] !== 'assets'
        || segments.some((segment) => segment === '.' || segment === '..')
    ) {
        throw new Error('Audio region target folder must be a project assets folder.');
    }

    return segments.join('/');
}
