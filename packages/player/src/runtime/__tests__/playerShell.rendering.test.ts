import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDefaultPlayerPreferences } from '../playerPreferences';
import { createDefaultPlayerShell } from '../playerShell';
import { normalizePlayerShellConfig } from '../playerShellConfig';
import { installPlayerShellInput } from '../playerShellInput';

vi.mock('../playerShellAppearance', () => ({ applyPlayerShellAppearance: vi.fn() }));
vi.mock('../playerShellSettings', () => ({ buildPlayerSettings: vi.fn() }));
vi.mock('../playerShellInput', () => ({ installPlayerShellInput: vi.fn(() => vi.fn()) }));
vi.mock('../playerShellDom', () => ({
    button: (label: string, action: () => void) => {
        const node = new FakeElement('button', label);
        node.action = action;
        return node;
    },
    element: (tag: string, _className?: string, text?: string) => new FakeElement(tag, text),
    focusable: (root: FakeElement) => root.querySelectorAll().filter(node => !node.disabled),
}));

class FakeElement {
    action?: () => void;
    attributes = new Map<string, string>();
    children: FakeElement[] = [];
    classList = { add: vi.fn() };
    dataset: Record<string, string> = {};
    disabled = false;
    hidden = false;
    id = '';
    inert = false;
    parentElement?: FakeElement;

    tag: string;
    textContent: string;

    constructor(tag: string, text = '') { this.tag = tag; this.textContent = text; }

    append(...nodes: FakeElement[]) {
        for (const node of nodes) {
            node.parentElement = this;
            this.children.push(node);
        }
    }
    click() { if (!this.disabled) this.action?.(); }
    contains(node: unknown): boolean { return this === node || this.children.some(child => child.contains(node)); }
    focus() { Object.defineProperty(document, 'activeElement', { configurable: true, value: this }); }
    querySelectorAll(): FakeElement[] {
        return this.children.flatMap(node => [...(node.tag === 'button' ? [node] : []), ...node.querySelectorAll()]);
    }
    remove() {
        if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this);
    }
    removeAttribute(name: string) { this.attributes.delete(name); }
    replaceChildren(...nodes: FakeElement[]) { this.children = []; this.append(...nodes); }
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
}

function fixture(customDisplay = false) {
    const host = new FakeElement('div');
    const canvas = new FakeElement('canvas');
    host.append(canvas);
    vi.stubGlobal('document', { activeElement: undefined, body: host, title: '' });
    const releases: ReturnType<typeof vi.fn>[] = [];
    const acquireRenderSuspension = vi.fn(() => {
        const release = vi.fn();
        releases.push(release);
        return release;
    });
    const flowRelease = vi.fn();
    const engine = {
        applySaveState: vi.fn(() => Promise.resolve()),
        audio: { setMasterVolume: vi.fn(), setVolume: vi.fn() },
        clear: vi.fn(),
        config: {},
        display: customDisplay ? {} : { acquireRenderSuspension },
        events: { off: vi.fn(), on: vi.fn() },
        flow: { acquireSuspension: vi.fn(() => flowRelease) },
        getHandler: vi.fn(),
        history: { getAll: () => [{ speaker: 'Aria', text: 'The current line.' }] },
        isStarted: true,
        overlay: { close: vi.fn() },
        saves: { getMeta: vi.fn(), hasSlot: vi.fn(() => false), listSlots: vi.fn(() => []), load: vi.fn(), save: vi.fn() },
        scenes: { hasScene: vi.fn(() => true), jumpToScene: vi.fn(() => Promise.resolve()) },
        setAutoAdvance: vi.fn(),
        setInputEnabled: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        theme: { fontSize: 24 },
    };
    const defaults = createDefaultPlayerPreferences();
    const shell = createDefaultPlayerShell({
        baseUrl: 'http://localhost/', canvas: canvas as unknown as HTMLCanvasElement,
        config: normalizePlayerShellConfig(), defaults, display: {} as never,
        engine: engine as never, preferences: defaults, startScene: 'intro',
    });
    const root = host.children[1];
    const input = vi.mocked(installPlayerShellInput).mock.calls.at(-1)![0];
    const click = (label: string) => {
        const control = root.querySelectorAll().find(node => node.textContent === label);
        expect(control, `Missing button: ${label}`).toBeDefined();
        control!.click();
    };
    const status = () => root.children[0].children[2].textContent;
    return { acquireRenderSuspension, click, engine, input, releases, root, shell, status };
}

describe('player shell rendering suspension', () => {
    beforeEach(() => vi.clearAllMocks());
    afterEach(() => vi.unstubAllGlobals());

    it('retains one title lease through settings and repeated start, then disposes it once', async () => {
        const state = fixture();
        const started = state.shell.start();
        state.click('Settings');
        state.click('Back');
        void state.shell.start();
        expect(state.acquireRenderSuspension).toHaveBeenCalledTimes(1);
        expect(state.releases[0]).not.toHaveBeenCalled();
        state.shell.dispose();
        state.shell.dispose();
        await started;
        expect(state.releases[0]).toHaveBeenCalledTimes(1);
    });

    it('retains the pause lease through History, Back and title cancellation, then releases on resume', async () => {
        const state = fixture();
        const started = state.shell.start();
        state.click('New Game');
        await started;
        await Promise.resolve();
        expect(state.releases[0]).toHaveBeenCalledTimes(1);
        state.input.open();
        state.click('History');
        expect(state.root.dataset.view).toBe('history');
        state.click('Back');
        state.click('Return to title');
        state.click('Cancel');
        expect(state.root.dataset.view).toBe('pause');
        expect(state.acquireRenderSuspension).toHaveBeenCalledTimes(2);
        expect(state.releases[1]).not.toHaveBeenCalled();
        state.click('Resume');
        state.shell.dispose();
        expect(state.releases[1]).toHaveBeenCalledTimes(1);
        expect(state.root.hidden).toBe(true);
    });

    it('retains the pause lease when returning to title and releases it when a new game starts', async () => {
        const state = fixture();
        const started = state.shell.start();
        state.click('New Game');
        await started;
        await Promise.resolve();
        state.input.open();
        state.click('Return to title');
        state.click('Confirm');
        expect(state.root.dataset.view).toBe('title');
        expect(state.releases[1]).not.toHaveBeenCalled();
        state.click('New Game');
        await vi.waitFor(() => expect(state.root.hidden).toBe(true));
        expect(state.acquireRenderSuspension).toHaveBeenCalledTimes(2);
        expect(state.releases[1]).toHaveBeenCalledTimes(1);
        state.shell.dispose();
    });

    it('holds rendering after a failed scene start and releases after a successful retry', async () => {
        const state = fixture();
        state.engine.scenes.jumpToScene.mockRejectedValueOnce(new Error('Scene unavailable.'));
        const started = state.shell.start();
        state.click('New Game');
        await vi.waitFor(() => expect(state.status()).toBe('Scene unavailable.'));
        expect(state.releases[0]).not.toHaveBeenCalled();
        state.click('New Game');
        await started;
        expect(state.acquireRenderSuspension).toHaveBeenCalledTimes(1);
        expect(state.releases[0]).toHaveBeenCalledTimes(1);
        state.shell.dispose();
    });

    it('holds rendering after an unreadable Continue save and releases after successful loading', async () => {
        const state = fixture();
        state.engine.saves.listSlots.mockReturnValue([{ savedAt: 1, sceneName: 'intro', slot: 1 }] as never);
        state.engine.saves.load.mockImplementationOnce(() => Promise.resolve()).mockResolvedValueOnce({ sceneName: 'intro' });
        const started = state.shell.start();
        state.click('Continue');
        await vi.waitFor(() => expect(state.status()).toBe('This save could not be read.'));
        expect(state.releases[0]).not.toHaveBeenCalled();
        state.click('Continue');
        await started;
        expect(state.acquireRenderSuspension).toHaveBeenCalledTimes(1);
        expect(state.releases[0]).toHaveBeenCalledTimes(1);
        state.shell.dispose();
    });

    it('disposes an open lease while scene loading is pending without restarting rendering later', async () => {
        const state = fixture();
        let complete!: () => void;
        state.engine.scenes.jumpToScene.mockImplementationOnce(() => new Promise<void>(resolve => { complete = resolve; }));
        const started = state.shell.start();
        state.click('New Game');
        state.shell.dispose();
        await started;
        complete();
        await Promise.resolve();
        await Promise.resolve();
        expect(state.engine.start).not.toHaveBeenCalled();
        expect(state.releases[0]).toHaveBeenCalledTimes(1);
        expect(state.acquireRenderSuspension).toHaveBeenCalledTimes(1);
    });

    it('supports custom displays without rendering suspension', async () => {
        const state = fixture(true);
        const started = state.shell.start();
        state.click('New Game');
        await started;
        state.input.open();
        state.click('Resume');
        state.shell.dispose();
        expect(state.acquireRenderSuspension).not.toHaveBeenCalled();
        expect(state.root.hidden).toBe(true);
    });
});
