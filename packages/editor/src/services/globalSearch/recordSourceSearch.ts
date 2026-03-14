import type { GlobalSearchMatch, GlobalSearchProjectData } from './contracts';
import type { ManifestFilePaths } from './manifestPaths';
import type { ResolvedGlobalSearchTextOptions } from './textSearch';

import { scanRecordStringLeaves } from './scan';

export function collectCharacterMatches(
    matches: GlobalSearchMatch[],
    query: string,
    characters: GlobalSearchProjectData['characters'],
    filePaths: Pick<ManifestFilePaths, 'charactersPath'>,
    textOptions: ResolvedGlobalSearchTextOptions,
): void {
    scanRecordStringLeaves(matches, {
        filePath: filePaths.charactersPath,
        kind: 'character',
        query,
        textOptions,
        values: characters,
    });
}

export function collectItemMatches(
    matches: GlobalSearchMatch[],
    query: string,
    items: GlobalSearchProjectData['items'],
    filePaths: Pick<ManifestFilePaths, 'itemsPath'>,
    textOptions: ResolvedGlobalSearchTextOptions,
): void {
    scanRecordStringLeaves(matches, {
        filePath: filePaths.itemsPath,
        kind: 'item',
        query,
        textOptions,
        values: items,
    });
}

