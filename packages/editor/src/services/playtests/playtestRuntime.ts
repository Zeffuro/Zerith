import type { Engine, SceneMap } from '@zeffuro/zerith-core';

import type { PlaytestScenario } from './playtestModel';

export async function startPlaytest(engine: Engine, scenario: PlaytestScenario, scenes: SceneMap, isCurrent: () => boolean): Promise<void> {
    if (!isCurrent()) return;
    engine.flow.stop();
    engine.clear();
    engine.scenes.loadScenes(scenes);
    engine.stateManager.replaceState(scenario.state);
    for (const id of scenario.inventory) {
        if (!engine.items.add(id)) throw new Error(`Could not add inventory item ${id}.`);
    }
    await engine.scenes.jumpToScene(scenario.scene, scenario.index);
    if (!isCurrent()) return;
    engine.start();
    engine.setInputEnabled(true);
}

export function validatePlaytestTarget(scenario: PlaytestScenario, scenes: SceneMap, itemIds: string[], locales: string[]): void {
    const script = scenes[scenario.scene];
    if (!script) throw new Error(`Scene ${scenario.scene} is no longer in this project.`);
    if (scenario.index >= script.length) throw new Error('The starting command is no longer in this scene.');
    const missing = scenario.inventory.filter(id => !itemIds.includes(id));
    if (missing.length > 0) throw new Error(`Unknown inventory items: ${missing.join(', ')}.`);
    if (scenario.locale && !locales.includes(scenario.locale)) throw new Error(`Locale ${scenario.locale} is no longer available.`);
}
