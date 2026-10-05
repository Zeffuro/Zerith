import { create } from 'zustand';

import type { PlaytestScenario } from '../services/playtests/playtestModel';

export type PlaytestRequest = { generation: number; id: number; projectPath: string; replay: boolean; scenario: PlaytestScenario };
type PlaytestState = {
    choices: number[];
    launch: (projectPath: string, scenario: PlaytestScenario, replay: boolean, generation?: number) => void;
    message: string;
    phase: 'failed' | 'idle' | 'playing' | 'starting';
    recordChoice: (index: number) => void;
    recordScene: (scene: string) => void;
    request?: PlaytestRequest;
    reset: () => void;
    setMessage: (message: string) => void;
    setPhase: (phase: PlaytestState['phase']) => void;
    visited: string[];
};
let nextRequestId = 0;
export const usePlaytestStore = create<PlaytestState>((set) => ({
    choices: [],
    launch: (projectPath, scenario, replay, generation = 0) => set({ choices: [], message: 'Starting playtest...', phase: 'starting', request: { generation, id: ++nextRequestId, projectPath, replay, scenario: structuredClone(scenario) }, visited: [] }),
    message: '',
    phase: 'idle',
    recordChoice: index => set(state => ({ choices: [...state.choices, index].slice(-512) })),
    recordScene: scene => set(state => ({ visited: state.visited.at(-1) === scene ? state.visited : [...state.visited, scene].slice(-512) })),
    request: undefined,
    reset: () => set({ choices: [], message: '', phase: 'idle', request: undefined, visited: [] }),
    setMessage: message => set({ message }),
    setPhase: phase => set({ phase }),
    visited: [],
}));
