import type { Engine } from '../Engine';

export function bindDefaultInputEvents(engine: Engine) {
    const { events, flow, notifications, saves } = engine;
    const report = (error: unknown) => notifications.show(error instanceof Error ? error.message : 'Save operation failed.');
    events.on('input:skip', () => flow.requestSkip());
    events.on('input:next', () => { void flow.playNext(); });
    events.on('input:save', (slot: number) => {
        try {
            saves.save(slot);
            notifications.show('Game Saved!');
        } catch (error) { report(error); }
    });
    events.on('input:load', (slot: number) => {
        void saves.load(slot).then(async saveData => {
            if (!saveData) {
                notifications.show('Save not found');
                return;
            }
            await engine.applySaveState(saveData);
            notifications.show('Game Loaded!');
        }).catch(report);
    });
}
