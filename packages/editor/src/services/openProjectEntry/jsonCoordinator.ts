import type { JsonHintKind, OpenProjectEntryOptions } from './contracts';

import { useProjectStore } from '../../store/storeBootstrap';
import { fsReadTextFile } from '../fs';
import { looksLikeMacrosObject } from '../projectOpeners';
import { handleJsonRoute } from './jsonHandlers';
import {
    resolveJsonKindFromManifest,
    resolveJsonKindFromSchema,
} from './jsonKindResolution';
import { routeJsonEntry } from './jsonRouting';

export async function openJsonEntry(fullPath: string, options?: OpenProjectEntryOptions): Promise<void> {
    const { manifest, projectPath } = useProjectStore.getState();
    const rawContents = await fsReadTextFile(fullPath);
    const kindFromManifest = resolveJsonKindFromManifest(fullPath, manifest, projectPath);
    const contents = normalizeBlankJsonContents(rawContents, kindFromManifest);
    const data: unknown = JSON.parse(contents);

    const kindFromSchema = resolveJsonKindFromSchema(data);
    const hintedKind = kindFromSchema ?? kindFromManifest;
    const route = routeJsonEntry({
        data,
        filePath: fullPath,
        hintedKind,
        isMacrosObject: looksLikeMacrosObject,
    });

    handleJsonRoute({
        contents,
        data,
        forceView: options?.forceView,
        fullPath,
        isMacrosObject: looksLikeMacrosObject,
        jsonSelectionPath: options?.jsonSelectionPath,
        route,
    });
}

function normalizeBlankJsonContents(contents: string, hintedKind: JsonHintKind): string {
    if (contents.trim().length > 0) return contents;

    return hintedKind === 'script' || hintedKind === undefined ? '[]\n' : '{}\n';
}

