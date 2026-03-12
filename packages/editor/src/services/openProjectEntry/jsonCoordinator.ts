import { useProjectStore } from '../../store/useProjectStore';
import { fsReadTextFile } from '../fs';
import {
    resolveJsonKindFromManifest,
    resolveJsonKindFromSchema,
} from '../openProjectEntryKind';
import { looksLikeMacrosObject } from '../projectOpeners';
import { handleJsonRoute } from './jsonHandlers';
import { routeJsonEntry } from './jsonRouting';
import type { OpenProjectEntryOptions } from './contracts';

export async function openJsonEntry(fullPath: string, options?: OpenProjectEntryOptions): Promise<void> {
    const contents = await fsReadTextFile(fullPath);
    const data: unknown = JSON.parse(contents);

    const { manifest, projectPath } = useProjectStore.getState();
    const kindFromSchema = resolveJsonKindFromSchema(data);
    const kindFromManifest = kindFromSchema ?? resolveJsonKindFromManifest(fullPath, manifest, projectPath);
    const route = routeJsonEntry({
        data,
        filePath: fullPath,
        hintedKind: kindFromManifest,
        isMacrosObject: looksLikeMacrosObject,
    });

    handleJsonRoute({
        contents,
        data,
        forceView: options?.forceView,
        fullPath,
        isMacrosObject: looksLikeMacrosObject,
        route,
    });
}

