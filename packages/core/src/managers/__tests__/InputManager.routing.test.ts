import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type InputConfig, InputManager } from '../InputManager';

function harness(config: InputConfig = {}) {
    let listener!: (event: KeyboardEvent) => void;
    let poll!: () => void;
    let gamepad: { axes: number[]; buttons: { pressed: boolean }[] } | undefined;
    const state = { overlay: false, started: true };
    const emit = vi.fn();
    vi.stubGlobal('addEventListener', (_name: string, callback: (event: KeyboardEvent) => void) => { listener = callback; });
    vi.stubGlobal('removeEventListener', vi.fn());
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => { poll = callback; return 1; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('navigator', { getGamepads: () => [gamepad] });
    const input = new InputManager({ emit } as never, {
        isOverlayOpen: () => state.overlay,
        isStarted: () => state.started,
    }, config);
    input.attach({ addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as HTMLCanvasElement);
    const key = (value: string, overrides: Partial<KeyboardEvent> = {}) => {
        const event = { altKey: false, ctrlKey: false, defaultPrevented: false, key: value, metaKey: false, preventDefault: vi.fn(), repeat: false, target: undefined, ...overrides };
        listener(event as unknown as KeyboardEvent);
        return event;
    };
    const pressGamepad = (button: number | number[]) => {
        const pressed = typeof button === 'number' ? [button] : button;
        gamepad = { axes: [], buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: pressed.includes(index) })) };
        poll();
    };
    return { emit, input, key, pressGamepad, state };
}

describe('runtime input routing', () => {
    beforeEach(() => vi.stubGlobal('document', { activeElement: undefined }));
    afterEach(() => vi.unstubAllGlobals());

    it('opens with the authored menu key and uses the back key inside menus', () => {
        const context = harness({ menuKey: 'm' });
        context.key('Escape');
        expect(context.emit).not.toHaveBeenCalled();
        context.key('m');
        expect(context.emit).toHaveBeenLastCalledWith('menu:toggle');
        context.state.overlay = true;
        context.key('Escape');
        expect(context.emit).toHaveBeenLastCalledWith('input:back');
    });

    it('routes overlapping menu, navigation, confirm and save keys once', () => {
        const context = harness({ advanceKeys: ['x'], confirmKeys: ['x'], menuKey: 'x', navigateDownKeys: ['x'], saveKey: 'x' });
        context.key('x');
        expect(context.emit.mock.calls).toEqual([['menu:toggle']]);
        context.state.overlay = true;
        context.key('x');
        expect(context.emit.mock.calls).toEqual([['menu:toggle'], ['input:back']]);
    });

    it('does not overwrite a save when S navigates a menu', () => {
        const context = harness();
        context.state.overlay = true;
        context.key('s');
        context.key('l');
        expect(context.emit.mock.calls).toEqual([['input:navigate', 'down']]);
    });

    it('does not advance after confirming a menu action that closes it', () => {
        const context = harness();
        context.state.overlay = true;
        context.emit.mockImplementation(() => { context.state.overlay = false; });
        context.key('Enter');
        expect(context.emit.mock.calls).toEqual([['input:confirm']]);
    });

    it('routes overlapping navigation and confirm as navigation inside a menu', () => {
        const context = harness({ confirmKeys: ['s'] });
        context.state.overlay = true;
        context.key('s');
        expect(context.emit.mock.calls).toEqual([['input:navigate', 'down']]);
    });

    it.each(['altKey', 'ctrlKey', 'metaKey'] as const)('ignores %s shortcuts', (modifier) => {
        const context = harness();
        context.key('s', { [modifier]: true });
        context.key('Enter', { [modifier]: true });
        expect(context.emit).not.toHaveBeenCalled();
    });

    it('ignores focused forms and editable targets', () => {
        const context = harness();
        const editable = { closest: vi.fn(() => ({})) } as unknown as EventTarget;
        context.key('s', { target: editable });
        vi.stubGlobal('document', { activeElement: editable });
        context.key('Enter');
        expect(context.emit).not.toHaveBeenCalled();
    });

    it('preserves authored save keys and prevents repeated writes', () => {
        const context = harness({ saveKey: 'Q' });
        context.key('Q', { shiftKey: true });
        context.key('q', { repeat: true });
        expect(context.emit.mock.calls).toEqual([['input:save', 1]]);
    });

    it('starts without confirming or advancing dialogue', () => {
        const context = harness();
        context.state.started = false;
        context.key('Enter');
        expect(context.emit.mock.calls).toEqual([['input:start']]);
    });

    it('does not advance after a gamepad confirm closes a menu', () => {
        const context = harness();
        context.state.overlay = true;
        context.emit.mockImplementation(() => { context.state.overlay = false; });
        context.pressGamepad(0);
        expect(context.emit.mock.calls).toEqual([['input:confirm']]);
        context.input.detach();
    });

    it.each([0, 9])('seeds held gamepad button %s when input reattaches', (button) => {
        const context = harness();
        context.pressGamepad(button);
        context.input.detach();
        context.emit.mockClear();
        context.input.attach({ addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as HTMLCanvasElement);
        context.pressGamepad(button);
        expect(context.emit).not.toHaveBeenCalled();
        context.pressGamepad(-1);
        context.pressGamepad(button);
        expect(context.emit).toHaveBeenCalled();
        context.input.detach();
    });

    it.each([1, 9])('gives gamepad menu button %s precedence over simultaneous advance', (menu) => {
        const context = harness();
        context.emit.mockImplementation(event => {
            if (event === 'menu:toggle') context.state.overlay = true;
            if (event === 'input:confirm') context.state.overlay = false;
        });
        context.pressGamepad([menu, 0]);
        context.pressGamepad([menu, 0]);
        expect(context.emit.mock.calls).toEqual([['menu:toggle']]);
        context.pressGamepad([]);
        context.pressGamepad(0);
        context.pressGamepad(0);
        expect(context.emit.mock.calls).toEqual([['menu:toggle'], ['input:confirm']]);
        context.pressGamepad([]);
        context.pressGamepad(0);
        expect(context.emit.mock.calls.slice(-3)).toEqual([['input:confirm'], ['input:skip'], ['input:next']]);
        context.input.detach();
    });
});
