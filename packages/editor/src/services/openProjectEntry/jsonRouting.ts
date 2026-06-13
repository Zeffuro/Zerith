import type { JsonHintKind, JsonResourceKind } from './contracts';

import { isManifestFilePath } from './pathHelpers';

export type JsonRoute =
    | { kind: 'macros'; requiresObjectShape: boolean }
    | { kind: 'resource'; resourceKind: JsonResourceKind }
    | { kind: 'script'; requiresArrayShape: boolean }
    | { kind: 'unknownJson'; tabKind: 'json' | 'manifest' };

type RouteJsonEntryOptions = {
    data: unknown;
    filePath: string;
    hintedKind: JsonHintKind;
    isMacrosObject: (value: unknown) => boolean;
};

const RESOURCE_HINT_KINDS = new Set<string>(['characters', 'engineConfig', 'items', 'manifest']);

export function routeJsonEntry(options: RouteJsonEntryOptions): JsonRoute {
    const { data, filePath, hintedKind, isMacrosObject } = options;

    if (isResourceHintKind(hintedKind)) {
        return { kind: 'resource', resourceKind: hintedKind };
    }

    if (hintedKind === 'script') {
        return { kind: 'script', requiresArrayShape: true };
    }

    if (hintedKind === 'macros') {
        return { kind: 'macros', requiresObjectShape: true };
    }

    if (Array.isArray(data)) {
        return { kind: 'script', requiresArrayShape: false };
    }

    if (isMacrosObject(data)) {
        return { kind: 'macros', requiresObjectShape: false };
    }

    const isManifestFile = isManifestFilePath(filePath);
    return { kind: 'unknownJson', tabKind: isManifestFile ? 'manifest' : 'json' };
}

function isResourceHintKind(kind: JsonHintKind): kind is JsonResourceKind {
    return typeof kind === 'string' && RESOURCE_HINT_KINDS.has(kind);
}
