import type { AudioRegion, AudioRegionBatchNamePreset } from '../utils/audioRegions';

import { createAudioRegionBatchExportPlan } from '../utils/audioRegions';
import {
    fsJoin,
    fsMkdir,
    fsReadDirectory,
    fsWriteBinaryFile,
} from './fs';

export type SaveAudioRegionDependencies = {
    join: (...parts: string[]) => Promise<string>;
    mkdir: (path: string, recursive?: boolean) => Promise<void>;
    readDirectory: (path: string) => Promise<readonly { name: string }[]>;
    writeBinaryFile: (path: string, content: Uint8Array) => Promise<void>;
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

const DEFAULT_SAVE_AUDIO_REGION_DEPENDENCIES: SaveAudioRegionDependencies = {
    join: fsJoin,
    mkdir: fsMkdir,
    readDirectory: fsReadDirectory,
    writeBinaryFile: fsWriteBinaryFile,
};

export async function saveAudioRegionWavToProject(
    projectPath: string,
    input: SaveAudioRegionInput,
    dependencies: SaveAudioRegionDependencies = DEFAULT_SAVE_AUDIO_REGION_DEPENDENCIES,
): Promise<SaveAudioRegionResult> {
    if (!projectPath) {
        throw new Error('Cannot save audio selection without an open project.');
    }

    const targetFolder = normalizeTargetFolder(input.targetFolder ?? DEFAULT_AUDIO_REGION_TARGET_FOLDER);
    const targetDirectory = await dependencies.join(projectPath, targetFolder);
    await dependencies.mkdir(targetDirectory, true);

    const existingEntries = await dependencies.readDirectory(targetDirectory);
    const [plannedExport] = createAudioRegionBatchExportPlan(input.sourcePath, [input.region], {
        existingFileNames: existingEntries.map((entry) => entry.name),
        namePreset: input.namePreset,
    });
    if (plannedExport === undefined) {
        throw new Error('Cannot save audio selection without a selected region.');
    }

    const targetName = plannedExport.fileName;
    const targetPath = await dependencies.join(targetDirectory, targetName);

    await dependencies.writeBinaryFile(targetPath, input.wavBytes);

    return {
        assetUrl: `/${targetFolder}/${targetName}`,
        collisionResolved: plannedExport.collisionResolved,
        targetName,
        targetPath,
    };
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
