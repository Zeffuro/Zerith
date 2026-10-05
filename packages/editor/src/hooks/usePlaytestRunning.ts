import { useProjectStore } from '../store/storeBootstrap';
import { usePlaytestStore } from '../store/usePlaytestStore';

export function usePlaytestRunning(): boolean {
    const projectPath = useProjectStore(state => state.projectPath);
    const generation = useProjectStore(state => state.projectGeneration);
    return usePlaytestStore(state => state.request?.projectPath === projectPath && state.request?.generation === generation && (state.phase === 'starting' || state.phase === 'playing'));
}
