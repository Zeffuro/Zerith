import type { AssetResolver } from './Engine';
import type { EngineConfig } from './EngineConfig';
import type { EvidenceItem } from './managers/EvidenceManager';
import type { CharacterDefinition, GameManifest, Script } from './types';

import { bindDefaultInputEvents } from './bootstrap/bindDefaultInputEvents';
import { createManagers } from './bootstrap/createManagers';
import { createPanels } from './bootstrap/createPanels';
import { registerHandlers } from './bootstrap/registerHandlers';
import { Engine } from './Engine';

export interface EngineBootstrapOptions {
    assetResolver?: AssetResolver;
    canvas: HTMLCanvasElement;
    characters?: Record<string, CharacterDefinition>;
    config?: EngineConfig;
    defaultBlipUrl?: null | string;
    items?: Record<string, Omit<EvidenceItem, 'id'>>;
    macros?: Record<string, Script>;
    manifest?: GameManifest;
    preloadAssets?: boolean;
    scenes?: Record<string, Script>;
    signal?: AbortSignal;
}

export async function bootstrapEngine(options: EngineBootstrapOptions): Promise<Engine> {
    const {
        assetResolver,
        canvas,
        characters = {},
        config = {},
        defaultBlipUrl,
        items = {},
        macros = {},
        manifest = {},
        preloadAssets = false,
        scenes = {},
        signal,
    } = options;

    signal?.throwIfAborted();

    const {
        deps,
        evidence,
        flow,
        history,
        logger,
        overlay,
        saveManager,
        sceneManager,
        state,
        theme,
    } = createManagers({ config, contentSchemaVersion: manifest.schemaVersion });
    const engine = new Engine(config, deps);
    const cancel = () => engine.destroy();
    signal?.addEventListener('abort', cancel, { once: true });
    try {
        signal?.throwIfAborted();
        const manifestData = { ...manifest, characters };
        const effectiveDefaultBlipUrl = resolveDefaultBlipUrl(config, defaultBlipUrl);
        const { dialogueHandler } = registerHandlers({
            accessibility: config.accessibility,
            animations: deps.animations,
            assets: deps.assets,
            audio: deps.audio,
            characters,
            defaultBlipUrl: effectiveDefaultBlipUrl,
            display: deps.display,
            events: deps.events,
            evidence,
            flow,
            history,
            logger,
            manifestData,
            sceneManager,
            spritesheets: deps.spritesheets,
            state,
            text: config.text,
            theme,
        });

        engine.theme = theme;
        engine.logger = logger;

        if (assetResolver) {
            engine.assetResolver = assetResolver;
        }

        engine.setManifest(manifestData);

        if (preloadAssets) {
            await deps.assets.preloadCharacterAssets(characters);
            signal?.throwIfAborted();
        }

        if (Object.keys(items).length > 0) {
            engine.items.loadDefinitions(items);
        }

        engine.registerDefaultPanels(createPanels({
            assets: deps.assets,
            dialogueHandler,
            engine,
            evidence,
            history,
            notifications: deps.notifications,
            overlay,
            saveManager,
        }));

        if (Object.keys(macros).length > 0) {
            for (const [name, script] of Object.entries(macros)) {
                sceneManager.registerTemplate(name, script);
            }
        }

        if (Object.keys(scenes).length > 0) {
            sceneManager.loadScenes(scenes);
        }

        await engine.init(canvas);
        signal?.throwIfAborted();
        bindDefaultInputEvents(engine);
        state.loadPersistentState(saveManager.loadGlobalState());

        return engine;
    } catch (error) {
        engine.destroy();
        throw error;
    } finally {
        signal?.removeEventListener('abort', cancel);
    }
}

function resolveDefaultBlipUrl(config: EngineConfig, override: null | string | undefined): string | undefined {
    if (override !== undefined) {
        return override ?? undefined;
    }

    const configDefaultBlipUrl = config.audio?.defaultBlipUrl;
    if (configDefaultBlipUrl !== undefined) {
        return configDefaultBlipUrl ?? undefined;
    }

    return '/assets/sfx/blip.wav';
}
