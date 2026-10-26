import type { StoryMapFile } from './storyMapProject';

import { canonicalPathForComparison } from '../../utils/pathComparison';
import { fsReadTextFile } from '../fs';

export async function readStoryMapFiles(paths: string[], readTextFile = fsReadTextFile) {
    const unique = new Map(paths.map(path => [canonicalPathForComparison(path), path]));
    return new Map(await Promise.all([...unique].map(async ([key, path]): Promise<[string, StoryMapFile]> => {
        try { return [key, { text: await readTextFile(path) }]; }
        catch (error) { return [key, { error: error instanceof Error ? error.message : String(error) }]; }
    })));
}
