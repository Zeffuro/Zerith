import type { EventSystemOptions, Renderer } from 'pixi.js';

import { EventsTicker, EventSystem } from 'pixi.js';

export function createOwnedEventSystem(isRetired: () => boolean): typeof EventSystem {
    return class OwnedEventSystem extends EventSystem {
        constructor(renderer: Renderer) {
            const previous = captureTicker();
            super(renderer);
            if (isRetired()) restoreTicker(previous);
        }

        public override destroy(): void {
            const previous = captureTicker();
            try {
                super.destroy();
            } finally {
                if (previous.events !== this) restoreTicker(previous);
            }
        }

        public override init(options: EventSystemOptions): void {
            if (!isRetired()) super.init(options);
        }
    };
}

function captureTicker() {
    return {
        domElement: EventsTicker.domElement,
        events: EventsTicker.events,
        frequency: EventsTicker.interactionFrequency,
        paused: EventsTicker.pauseUpdate,
    };
}

function restoreTicker(previous: ReturnType<typeof captureTicker>): void {
    if (!previous.events) {
        EventsTicker.destroy();
        return;
    }
    EventsTicker.init(previous.events);
    EventsTicker.domElement = previous.domElement;
    EventsTicker.interactionFrequency = previous.frequency;
    EventsTicker.pauseUpdate = previous.paused;
    EventsTicker.addTickerListener();
}
