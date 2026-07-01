import type { DialogueAnnouncement, EngineConfig } from 'zerith-core';

export type PlayerAccessibilityAppendTarget = {
    append: (child: PlayerAccessibilityLiveRegion) => unknown;
};

export type PlayerAccessibilityCanvas = {
    getAttribute?: (name: string) => null | string | undefined;
    parentElement?: unknown;
    setAttribute?: (name: string, value: string) => void;
    tabIndex?: number;
};

export type PlayerAccessibilityDocument = {
    body?: unknown;
    createElement: (tagName: string) => PlayerAccessibilityLiveRegion;
};

export type PlayerAccessibilityLiveRegion = {
    remove?: () => void;
    setAttribute: (name: string, value: string) => void;
    style?: Partial<CSSStyleDeclaration>;
    textContent?: null | string;
};

export type PlayerAccessibilityShell = {
    config: EngineConfig;
    dispose: () => void;
    liveRegion?: PlayerAccessibilityLiveRegion;
};

type PlayerAccessibilityShellOptions = {
    container?: unknown;
    document?: PlayerAccessibilityDocument;
    label?: string;
};

const DEFAULT_PLAYER_LABEL = 'Zerith visual novel player';

export function configurePlayerAccessibilityShell(
    canvas: PlayerAccessibilityCanvas,
    config: EngineConfig,
    options: PlayerAccessibilityShellOptions = {},
): PlayerAccessibilityShell {
    configurePlayerCanvas(canvas, options.label ?? DEFAULT_PLAYER_LABEL);

    const accessibility = config.accessibility;
    if (
        !accessibility
        || (accessibility.captions !== true && accessibility.selfVoicing !== true)
        || typeof accessibility.announceDialogue === 'function'
    ) {
        return { config, dispose: noop };
    }

    const documentReference = options.document ?? globalThis.document;
    const liveRegion = createPlayerLiveRegion(documentReference);
    if (!liveRegion) {
        return { config, dispose: noop };
    }

    const appendTarget = toAppendTarget(options.container)
        ?? toAppendTarget(canvas.parentElement)
        ?? toAppendTarget(documentReference.body);
    appendTarget?.append(liveRegion);

    return {
        config: {
            ...config,
            accessibility: {
                ...accessibility,
                announceDialogue: createPlayerDialogueAnnouncer(liveRegion),
            },
        },
        dispose: () => {
            liveRegion.remove?.();
        },
        liveRegion,
    };
}

export function createPlayerDialogueAnnouncer(liveRegion: PlayerAccessibilityLiveRegion) {
    return (announcement: DialogueAnnouncement): void => {
        liveRegion.textContent = formatPlayerDialogueAnnouncement(announcement);
    };
}

export function formatPlayerDialogueAnnouncement(announcement: Pick<DialogueAnnouncement, 'speaker' | 'text'>): string {
    const speaker = announcement.speaker.trim();
    const text = announcement.text.trim();
    return speaker.length > 0 ? `${speaker}: ${text}` : text;
}

function configurePlayerCanvas(canvas: PlayerAccessibilityCanvas, label: string): void {
    if (typeof canvas.setAttribute === 'function') {
        if (!canvas.getAttribute?.('role')) {
            canvas.setAttribute('role', 'application');
        }

        if (!canvas.getAttribute?.('aria-label')) {
            canvas.setAttribute('aria-label', label);
        }
    }

    if (typeof canvas.tabIndex === 'number' && canvas.tabIndex < 0) {
        canvas.tabIndex = 0;
    }
}

function createPlayerLiveRegion(documentReference: PlayerAccessibilityDocument | undefined): PlayerAccessibilityLiveRegion | undefined {
    if (!documentReference) return;

    const liveRegion = documentReference.createElement('div');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('role', 'status');
    liveRegion.textContent = '';

    if (liveRegion.style) {
        Object.assign(liveRegion.style, {
            clip: 'rect(0 0 0 0)',
            clipPath: 'inset(50%)',
            height: '1px',
            overflow: 'hidden',
            position: 'absolute',
            whiteSpace: 'nowrap',
            width: '1px',
        });
    }

    return liveRegion;
}

function noop(): void {}

function toAppendTarget(value: unknown): PlayerAccessibilityAppendTarget | undefined {
    if (
        value
        && typeof value === 'object'
        && 'append' in value
        && typeof (value as { append?: unknown }).append === 'function'
    ) {
        return value as PlayerAccessibilityAppendTarget;
    }

    return;
}
