import { GameManifestSchema, LocaleBundleSchema } from '@zeffuro/zerith-core/schemas';

import type { ProjectState } from '../store/project/types';

import { canonicalPathForComparison } from '../utils/pathComparison';

export function validateLocalizationFileSnapshot(path: string, text: string, project: Pick<ProjectState, 'localePaths' | 'locales' | 'projectPath'>): void {
    const key = canonicalPathForComparison(path);
    const manifestPath = `${project.projectPath?.replaceAll(/[\\/]+$/gu, '')}/game.json`;
    if (Object.values(project.localePaths ?? {}).some(candidate => candidate !== undefined && canonicalPathForComparison(candidate) === key)) {
        LocaleBundleSchema.parse(JSON.parse(text) as unknown);
    } else if (Object.keys(project.locales ?? {}).some(locale => !project.localePaths[locale])
        && canonicalPathForComparison(manifestPath) === key) {
        GameManifestSchema.parse(JSON.parse(text) as unknown);
    }
}
