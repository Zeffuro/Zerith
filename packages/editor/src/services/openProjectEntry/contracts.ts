export type ForceView = 'json' | 'timeline';

export type JsonHintKind = 'macros' | 'script' | JsonResourceKind | undefined;

export type JsonResourceKind = 'characters' | 'items' | 'manifest';

export type OpenProjectEntryOptions = {
	forceView?: ForceView;
	openInSpritesheetEditor?: boolean;
};

