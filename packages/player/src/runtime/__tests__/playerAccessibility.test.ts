import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    configurePlayerAccessibilityShell,
    createPlayerDialogueAnnouncer,
    formatPlayerDialogueAnnouncement,
    type PlayerAccessibilityCanvas,
    type PlayerAccessibilityLiveRegion,
} from '../playerAccessibility';

class FakeElement implements PlayerAccessibilityLiveRegion {
    public readonly attributes = new Map<string, string>();
    public readonly children: FakeElement[] = [];
    public removed = false;
    public style: Partial<CSSStyleDeclaration> = {};
    public textContent?: null | string;

    public append(child: PlayerAccessibilityLiveRegion) {
        this.children.push(child as FakeElement);
        return child;
    }

    public getAttribute(name: string): string | undefined {
        return this.attributes.get(name);
    }

    public remove() {
        this.removed = true;
    }

    public setAttribute(name: string, value: string) {
        this.attributes.set(name, value);
    }
}

describe('playerAccessibility', () => {
    afterEach(() => vi.unstubAllGlobals());
    it('speaks only self-voiced lines and stops its speech on disposal', () => {
        const speech = { cancel: vi.fn(), speak: vi.fn() };
        vi.stubGlobal('speechSynthesis', speech);
        vi.stubGlobal('SpeechSynthesisUtterance', class {
            text: string;
            constructor(text: string) { this.text = text; }
        });
        const announce = createPlayerDialogueAnnouncer(new FakeElement());
        announce({ captions: true, selfVoicing: false, speaker: 'Ari', text: 'The last train.' });
        expect(speech.speak).not.toHaveBeenCalled();
        announce({ captions: false, selfVoicing: true, speaker: 'Ari', text: 'The last train.' });
        expect(speech.speak).toHaveBeenCalledWith(expect.objectContaining({ text: 'Ari: The last train.' }));
        announce.dispose();
        expect(speech.cancel).toHaveBeenCalledOnce();
    });
    it('marks the player canvas as a focusable application surface', () => {
        const canvas = new FakeElement() as FakeElement & PlayerAccessibilityCanvas;
        canvas.tabIndex = -1;

        const shell = configurePlayerAccessibilityShell(canvas, {});

        expect(canvas.getAttribute('role')).toBe('application');
        expect(canvas.getAttribute('aria-label')).toBe('Zerith visual novel player');
        expect(canvas.tabIndex).toBe(0);
        expect(shell.config).toEqual({});
    });

    it('adds a live region announcer when captions or self-voicing need a default host', () => {
        const parent = new FakeElement();
        const canvas = new FakeElement() as FakeElement & PlayerAccessibilityCanvas;
        canvas.parentElement = parent;
        const document = {
            body: new FakeElement(),
            createElement: vi.fn(() => new FakeElement()),
        };

        const shell = configurePlayerAccessibilityShell(canvas, {
            accessibility: {
                captions: true,
            },
        }, { document });

        expect(document.createElement).toHaveBeenCalledWith('div');
        expect(parent.children).toHaveLength(1);
        const liveRegion = shell.liveRegion as FakeElement | undefined;
        expect(liveRegion?.getAttribute('role')).toBe('status');
        expect(liveRegion?.getAttribute('aria-live')).toBe('polite');
        expect(liveRegion?.style).toMatchObject({
            clip: 'rect(0 0 0 0)',
            clipPath: 'inset(50%)',
            height: '1px',
            overflow: 'hidden',
            position: 'absolute',
            whiteSpace: 'nowrap',
            width: '1px',
        });
        expect(typeof shell.config.accessibility?.announceDialogue).toBe('function');

        void shell.config.accessibility?.announceDialogue?.({
            captions: true,
            selfVoicing: false,
            speaker: 'Ari',
            text: 'Line ready.',
        });

        expect(liveRegion?.textContent).toBe('Ari: Line ready.');
        shell.dispose();
        expect(liveRegion?.removed).toBe(true);
    });

    it('keeps host-provided announcement handlers intact', () => {
        const announceDialogue = vi.fn();
        const document = {
            body: new FakeElement(),
            createElement: vi.fn(() => new FakeElement()),
        };

        const shell = configurePlayerAccessibilityShell(new FakeElement(), {
            accessibility: {
                announceDialogue,
                captions: true,
                selfVoicing: true,
            },
        }, { document });

        expect(shell.config.accessibility?.announceDialogue).toBe(announceDialogue);
        expect(document.createElement).not.toHaveBeenCalled();
    });

    it('formats and writes dialogue announcements for live regions', () => {
        const liveRegion = new FakeElement();
        const announcer = createPlayerDialogueAnnouncer(liveRegion);

        expect(formatPlayerDialogueAnnouncement({ speaker: '  ', text: ' Hello ' })).toBe('Hello');
        announcer({
            captions: false,
            selfVoicing: true,
            speaker: 'Narrator',
            text: 'The door opens.',
        });

        expect(liveRegion.textContent).toBe('Narrator: The door opens.');
    });
});
