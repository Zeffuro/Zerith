import type { Engine } from './Engine';
import type { SaveState } from './managers/SaveManager';
import type { BaseCommand } from './types';

import { isCursor, parseFlowContinuation } from './managers/flowContinuation';
import { deepClone } from './utils/deepClone';

export async function restoreEngineSave(engine: Engine, input: SaveState, isCurrent: () => boolean, commit: () => void): Promise<void> {
    const save = deepClone(input);
    if (save.saveSchemaVersion !== undefined && ![0, 1, 2].includes(save.saveSchemaVersion)) throw new Error('The save version is unsupported.');
    if (!isCursor(save.index) || !engine.scenes.hasScene(save.sceneName)) throw new Error('The save scene or cursor is invalid.');
    const continuation = save.continuation === undefined ? undefined : parseFlowContinuation(save.continuation);
    if (save.continuation !== undefined && (!continuation || save.saveSchemaVersion !== 2)) throw new Error('The save continuation is invalid.');
    if (!engine.scenes.prepareSaveRestore || !engine.scenes.isPreparedRestoreCurrent || !engine.scenes.commitSaveRestore
        || (continuation && !engine.flow.restoreSaveContinuation)) throw new Error('These runtime managers do not support safe save restoration.');
    const release = engine.flow.acquireSuspension?.();
    let released = false;
    const releaseOnce = () => { if (!released) { released = true; release?.(); } };
    try {
        const prepared = await engine.scenes.prepareSaveRestore(save.sceneName, save.index, continuation);
        const presentationAssets: BaseCommand[] = [];
        if (save.system.background) presentationAssets.push({ assetUrl: save.system.background, type: 'background' });
        if (save.system.bgm) presentationAssets.push({ action: 'play', assetUrl: save.system.bgm, type: 'bgm' });
        for (const [id, sprite] of Object.entries(save.system.sprites)) {
            if (sprite.assetUrl) presentationAssets.push({ action: 'show', assetUrl: sprite.assetUrl, id, type: 'sprite' });
        }
        if (presentationAssets.length > 0) await engine.assets.preloadSceneAssets(presentationAssets, { strict: true });
        if (!isCurrent()) throw new Error('This save load was cancelled by a newer operation.');
        if (!engine.scenes.isPreparedRestoreCurrent(prepared)) throw new Error('Game content changed while loading this save.');
        commit();
        engine.scenes.commitSaveRestore(prepared);
        if (continuation) engine.flow.restoreSaveContinuation?.(continuation);
        engine.stateManager.replaceState(save.state, save.system);
        engine.items.deserialize(save.system.items);
        engine.history.deserialize(save.system.history ?? []);
        engine.events.emit('state:loaded', save);
        releaseOnce();
        if (engine.isStarted && isCurrent()) engine.start();
    } finally {
        releaseOnce();
    }
}
