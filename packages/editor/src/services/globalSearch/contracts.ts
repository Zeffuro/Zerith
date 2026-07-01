import type { CharacterDefinition, ItemManifestEntry, Script } from 'zerith-core';

import type { ScriptPath } from '../../utils/scriptPathUtilities';

export type GlobalSearchKind = 'character' | 'item' | 'macro' | 'scene';

export type GlobalSearchMatch = {
    filePath: string;
    kind: GlobalSearchKind;
    label: string;
    matchedValue: string;
    path: ScriptPath | undefined;
    preview: string;
    replaceable: boolean;
    valuePath: ScriptPath | undefined;
};

export type GlobalSearchProjectData = {
    characters: Record<string, CharacterDefinition>;
    items: Record<string, ItemManifestEntry>;
    macros: Record<string, Script>;
    manifest: unknown;
    projectPath: string | undefined;
    scenes: Record<string, Script>;
};

export type GlobalSearchReplacementFile = {
    content: string;
    filePath: string;
    kind: ReplacementTarget['kind'];
};

export type GlobalSearchTextOptions = {
    caseSensitive?: boolean;
    regex?: boolean;
};

export type RecordSearchKind = Extract<GlobalSearchKind, 'character' | 'item'>;

export type ReplacementManifestKind = Exclude<GlobalSearchKind, 'scene'>;

export type ReplacementTarget =
    | { kind: 'scene'; sceneName: string }
    | { kind: ReplacementManifestKind };

export type ScriptSearchKind = Extract<GlobalSearchKind, 'macro' | 'scene'>;

