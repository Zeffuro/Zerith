import type { Engine } from '../Engine';

export async function preloadCharacterAssets(
    engine: Engine,
    characters: Record<string, any>
): Promise<void> {
    if (Object.keys(characters).length === 0) return;

    const { Assets } = await import('pixi.js');
    const { sound } = await import('@pixi/sound');

    const promises: Promise<any>[] = [];

    for (const [, char] of Object.entries(characters) as [string, any][]) {
        if (char.portraitUrl) {
            promises.push(Assets.load(char.portraitUrl).catch(() => {}));
        }

        if (char.blipUrl && !sound.exists(char.blipUrl)) {
            promises.push(
                new Promise<void>((resolve) => {
                    sound.add(char.blipUrl, {
                        url: char.blipUrl,
                        preload: true,
                        loaded: () => resolve(),
                    });
                })
            );
        }

        if (char.spritesheet?.atlasUrl) {
            promises.push(
                engine.spritesheets.load(char.spritesheet).catch((err) => {
                    console.warn(`Failed to preload spritesheet: ${char.spritesheet.atlasUrl}`, err);
                })
            );
        }
    }

    await Promise.all(promises);
}

