import type { Engine, SceneMap } from '@zeffuro/zerith-core';

import { useEffect, useRef } from 'react';

import { startPlaytest } from '../services/playtests/playtestRuntime';
import { useProjectStore } from '../store/storeBootstrap';
import { useEngineBridgeStore } from '../store/useEngineBridgeStore';
import { usePlaytestStore } from '../store/usePlaytestStore';

export function usePlaytestPlayback(projectPath: string | undefined, scenes: SceneMap): void {
    const engine = useEngineBridgeStore(state => state.engine);
    const generation = useProjectStore(state => state.projectGeneration);
    const request = usePlaytestStore(state => state.request);
    const started = useRef<{ engine: Engine; id: number } | undefined>(undefined);
    const scenesReference = useRef(scenes);
    scenesReference.current = scenes;

    useEffect(() => {
        if (request && (request.projectPath !== projectPath || request.generation !== generation)) {
            usePlaytestStore.getState().reset();
            return;
        }
        if (!engine || useEngineBridgeStore.getState().engine !== engine || !request || request.projectPath !== projectPath || request.generation !== generation || (started.current?.id === request.id && started.current.engine === engine)) return;
        started.current = { engine, id: request.id };
        let cancelled = false;
        let nextChoice = 0;
        let replayFailed = false;
        const store = usePlaytestStore.getState();
        const isCurrent = () => !cancelled && useProjectStore.getState().projectGeneration === request.generation && useEngineBridgeStore.getState().engine === engine && usePlaytestStore.getState().request?.id === request.id;
        const recordScene = (scene: string) => { if (isCurrent()) store.recordScene(scene); };
        const recordChoice = (index: number) => {
            if (!isCurrent()) return;
            store.recordChoice(index);
            if (replayFailed) { replayFailed = false; engine.resume(); store.setMessage(`Playing ${request.scenario.name}.`); }
        };
        const replayChoice = (count: number) => {
            if (!request.replay || !isCurrent()) return;
            const index = request.scenario.choices[nextChoice++];
            if (index === undefined || index >= count) {
                replayFailed = true;
                engine.pause();
                store.setMessage('Recorded choices do not match this route. Continue manually or update the recording.');
                return;
            }
            engine.events.emit('input:choose', index);
        };
        engine.events.on('flow:scene_entered', recordScene);
        engine.events.on('choice:selected', recordChoice);
        engine.events.on('choice:shown', replayChoice);
        store.recordScene(request.scenario.scene);
        void startPlaytest(engine, request.scenario, scenesReference.current, isCurrent)
            .then(() => { if (isCurrent()) { store.setPhase('playing'); if (!replayFailed) store.setMessage(`Playing ${request.scenario.name}.`); } })
            .catch((error: unknown) => { if (isCurrent()) { store.setPhase('failed'); store.setMessage(error instanceof Error ? error.message : String(error)); } });
        return () => {
            cancelled = true;
            if (started.current?.engine === engine && started.current.id === request.id) started.current = undefined;
            engine.events.off('flow:scene_entered', recordScene);
            engine.events.off('choice:selected', recordChoice);
            engine.events.off('choice:shown', replayChoice);
        };
    }, [engine, generation, projectPath, request]);
}
