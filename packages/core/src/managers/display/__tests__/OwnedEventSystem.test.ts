import type { Renderer } from 'pixi.js';

import { EventsTicker, EventSystem } from 'pixi.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createOwnedEventSystem } from '../OwnedEventSystem';

function canvas() {
    return { addEventListener: vi.fn(), removeEventListener: vi.fn(), style: {} };
}

function renderer(element = canvas()) {
    return { canvas: element, resolution: 1 };
}

describe('OwnedEventSystem global ticker ownership', () => {
    beforeEach(() => {
        vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
        vi.stubGlobal('navigator', {});
        vi.stubGlobal('addEventListener', vi.fn());
        vi.stubGlobal('removeEventListener', vi.fn());
        vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
        vi.stubGlobal('cancelAnimationFrame', vi.fn());
    });
    afterEach(() => { EventsTicker.destroy(); vi.unstubAllGlobals(); });

    it('preserves successor events and canvas when a retired constructor and initializer finish late', () => {
        const currentRenderer = renderer();
        const current = new EventSystem(currentRenderer as unknown as Renderer);
        current.init({ eventMode: 'dynamic' });
        EventsTicker.pauseUpdate = false;
        EventsTicker.interactionFrequency = 25;
        const OwnedEvents = createOwnedEventSystem(() => true);
        const oldRenderer = renderer();
        const old = new OwnedEvents(oldRenderer as unknown as Renderer);
        old.init({ eventMode: 'dynamic' });
        expect(EventsTicker.events).toBe(current);
        expect(EventsTicker.domElement).toBe(currentRenderer.canvas);
        expect(EventsTicker.pauseUpdate).toBe(false);
        expect(EventsTicker.interactionFrequency).toBe(25);
        expect(oldRenderer.canvas.addEventListener).not.toHaveBeenCalled();
        old.destroy();
        expect(EventsTicker.events).toBe(current);
        expect(EventsTicker.domElement).toBe(currentRenderer.canvas);
        current.destroy();
    });

    it('removes old DOM listeners while preserving a successor ticker after initialized old disposal', () => {
        let retired = false;
        const OwnedEvents = createOwnedEventSystem(() => retired);
        const oldRenderer = renderer();
        const old = new OwnedEvents(oldRenderer as unknown as Renderer);
        old.init({ eventMode: 'dynamic' });
        retired = true;
        const currentRenderer = renderer();
        const current = new EventSystem(currentRenderer as unknown as Renderer);
        current.init({ eventMode: 'dynamic' });
        EventsTicker.pauseUpdate = false;
        old.destroy();
        expect(oldRenderer.canvas.removeEventListener).toHaveBeenCalled();
        expect(currentRenderer.canvas.removeEventListener).not.toHaveBeenCalled();
        expect(EventsTicker.events).toBe(current);
        expect(EventsTicker.domElement).toBe(currentRenderer.canvas);
        expect(EventsTicker.pauseUpdate).toBe(false);
        current.destroy();
    });

    it('fully releases the event ticker when the disposed system is its current owner', () => {
        const OwnedEvents = createOwnedEventSystem(() => false);
        const old = new OwnedEvents(renderer() as unknown as Renderer);
        old.init({ eventMode: 'dynamic' });
        expect(EventsTicker.events).toBe(old);
        old.destroy();
        expect(EventsTicker.events).toBeNull();
        expect(EventsTicker.domElement).toBeNull();
    });

    it('does not register a retired constructor when there is no successor', () => {
        EventsTicker.destroy();
        const OwnedEvents = createOwnedEventSystem(() => true);
        const old = new OwnedEvents(renderer() as unknown as Renderer);
        old.init({});
        expect(EventsTicker.events).toBeNull();
        expect(EventsTicker.domElement).toBeNull();
        old.destroy();
    });
});
