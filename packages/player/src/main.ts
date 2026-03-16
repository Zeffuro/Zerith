import { bootstrapPlayer } from './runtime/bootstrapPlayer.ts';

async function main() {
    const canvas = document.querySelector('#game-canvas');

    if (!(canvas instanceof HTMLCanvasElement)) {
        throw new TypeError('Expected #game-canvas element to be a canvas.');
    }

    const baseUrl = new URL(import.meta.env.BASE_URL, globalThis.location.href).toString();
    const manifestUrl = new URL('game.json', globalThis.location.href).toString();

    await bootstrapPlayer({
        baseUrl,
        canvas,
        manifestUrl,
    });
}

await main();
