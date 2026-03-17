export type ForceView = 'json' | 'timeline';

export type JsonHintKind = 'macros' | 'script' | JsonResourceKind | undefined;

export type JsonResourceKind = 'characters' | 'engineConfig' | 'items' | 'manifest';

export type OpenProjectEntryOptions = {
	forceView?: ForceView;
	openInSpritesheetEditor?: boolean;
};

