import { bootstrapPlayer } from './runtime/bootstrapPlayer.ts';
import { desktopEngineConfig, resolveDesktopPlayer } from './runtime/desktopPlayer.ts';
import { resolvePlayerBaseUrl } from './runtime/playerBaseUrl.ts';

async function main() {
    const canvas = document.querySelector('#game-canvas');

    if (!(canvas instanceof HTMLCanvasElement)) {
        throw new TypeError('Expected #game-canvas element to be a canvas.');
    }

    const baseUrl = resolvePlayerBaseUrl();
    const manifestUrl = new URL('game.json', baseUrl).toString();

    const desktop = resolveDesktopPlayer(globalThis);
    await bootstrapPlayer({
        baseUrl,
        canvas,
        config: desktop ? desktopEngineConfig(desktop.metadata, localStorage) : undefined,
        manifestUrl,
    });
}

await main();
