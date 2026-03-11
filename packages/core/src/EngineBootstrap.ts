import type { AssetResolver } from './Engine';
import type { EngineConfig } from './EngineConfig';
import type { EvidenceItem } from './managers/EvidenceManager';
import type { CharacterDefinition, GameManifest, Script } from './types';

import { createManagers } from './bootstrap/createManagers';
import { createPanels } from './bootstrap/createPanels';
import { registerHandlers } from './bootstrap/registerHandlers';
import { Engine } from './Engine';

export interface EngineBootstrapOptions {
    assetResolver?: AssetResolver;
    canvas: HTMLCanvasElement;
    characters?: Record<string, CharacterDefinition>;
    config?: EngineConfig;
    defaultBlipUrl?: string;
    items?: Record<string, Omit<EvidenceItem, 'id'>>;
    macros?: Record<string, Script>;
    manifest?: GameManifest;
    preloadAssets?: boolean;
    scenes?: Record<string, Script>;
}

export async function bootstrapEngine(options: EngineBootstrapOptions): Promise<Engine> {
    const {
        assetResolver,
        canvas,
        characters = {},
        config = {},
        defaultBlipUrl = '/assets/sfx/blip.wav',
        items = {},
        macros = {},
        manifest = {},
        preloadAssets = false,
        scenes = {},
    } = options;

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
    } = createManagers({ config });
    const manifestData = { ...manifest, characters };
    const { dialogueHandler } = registerHandlers({
        animations: deps.animations,
        assets: deps.assets,
        audio: deps.audio,
        characters,
        defaultBlipUrl,
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
        theme,
    });

    const engine = new Engine(config, deps);
    engine.theme = theme;
    engine.logger = logger;

    if (assetResolver) {
        engine.assetResolver = assetResolver;
    }

    engine.setManifest(manifestData);

    if (preloadAssets) {
        await deps.assets.preloadCharacterAssets(characters);
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
    bindDefaultInputEvents(engine);
    state.loadPersistentState(saveManager.loadGlobalState());

    return engine;
}

function bindDefaultInputEvents(engine: Engine) {
    const events = engine.events;
    const flow = engine.flow;
    const notifications = engine.notifications;
    const saves = engine.saves;

    events.on('input:skip', () => {
        flow.requestSkip();
    });

    events.on('input:next', () => {
        void flow.playNext();
    });

    events.on('input:save', (slot: number) => {
        saves.save(slot);
        notifications.show('Game Saved!');
    });

    events.on('input:load', (slot: number) => {
        void saves.load(slot).then(async (saveData) => {
            if (!saveData) {
                notifications.show('Save not found');
                return;
            }

            await engine.applySaveState(saveData);
            notifications.show('Game Loaded!');
        });
    });
}
