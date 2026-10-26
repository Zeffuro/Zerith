import type { ScriptPath } from '../../utils/scriptPathUtilities';

export type ForceView = 'json' | 'timeline';

export type JsonHintKind = 'macros' | 'script' | JsonResourceKind | undefined;

export type JsonResourceKind = 'characters' | 'engineConfig' | 'items' | 'manifest';

export type OpenProjectEntryOptions = {
	forceView?: ForceView;
	jsonHintKind?: 'macros' | 'script';
	jsonSelectionPath?: ScriptPath;
	openInSpritesheetEditor?: boolean;
};

