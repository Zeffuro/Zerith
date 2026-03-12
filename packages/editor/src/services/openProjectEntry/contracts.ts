export type ForceView = 'json' | 'timeline';

export type JsonResourceKind = 'characters' | 'items' | 'manifest';

export type JsonHintKind = JsonResourceKind | 'macros' | 'script' | undefined;

export type OpenProjectEntryOptions = { forceView?: ForceView };

