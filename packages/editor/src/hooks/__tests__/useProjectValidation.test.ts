import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectValidationReport } from '../../services/projectValidationReport';
import type { ProjectValidationRunResult } from '../../services/projectValidationRun';

const mocks = vi.hoisted(() => {
    const project: { projectGeneration: number; projectPath: string | undefined } = { projectGeneration: 1, projectPath: '/A' };
    return {
    effects: [] as (() => void)[],
    index: 0,
    project,
    run: vi.fn<(session: { projectGeneration: number; projectPath: string | undefined }, active: () => boolean) => Promise<ProjectValidationRunResult>>(),
    setters: vi.fn(),
    setups: [] as (() => void)[],
    slots: [] as { cleanup?: () => void; deps?: unknown[]; value?: unknown }[],
    };
});

function memo(factory: () => unknown, deps: unknown[]) {
    const index = mocks.index++;
    const previous = mocks.slots[index];
    if (!previous || deps.some((value, position) => value !== previous.deps?.[position])) {
        mocks.slots[index] = { deps, value: factory() };
    }
    return mocks.slots[index].value;
}

vi.mock('react', () => {
    return {
        useCallback: (callback: unknown, deps: unknown[]) => memo(() => callback, deps),
        useEffect: (factory: () => () => void, deps: unknown[]) => {
            const index = mocks.index++;
            const previous = mocks.slots[index];
            if (!previous || deps.some((value, position) => value !== previous.deps?.[position])) {
                const slot = mocks.slots[index] = { deps, value: undefined } as typeof previous;
                const setup = () => { slot.cleanup = factory(); };
                mocks.setups.push(setup);
                mocks.effects.push(() => { previous?.cleanup?.(); setup(); });
            }
        },
        useMemo: memo,
        useRef: (value: unknown) => {
            const index = mocks.index++;
            mocks.slots[index] ??= { value: { current: value } };
            return mocks.slots[index].value;
        },
        useState: (initial: unknown) => {
            const index = mocks.index++;
            mocks.slots[index] ??= { value: initial };
            return [mocks.slots[index].value, (value: unknown) => { mocks.setters(value); mocks.slots[index].value = value; }];
        },
    };
});
vi.mock('../../services/projectValidationRun', () => ({
    matchesProjectValidationSession: (current: typeof mocks.project, captured: typeof mocks.project) => current.projectPath === captured.projectPath && current.projectGeneration === captured.projectGeneration,
    runSavedProjectValidation: mocks.run,
}));
vi.mock('../../store/storeBootstrap', () => ({
    useProjectStore: Object.assign((selector: (state: typeof mocks.project) => unknown) => selector(mocks.project), { getState: () => mocks.project }),
}));

import { useProjectValidation } from '../useProjectValidation';

function deferred() {
    let resolve!: (value: ProjectValidationRunResult) => void;
    const promise = new Promise<ProjectValidationRunResult>(yes => { resolve = yes; });
    return { promise, resolve };
}
function render(flushEffects = true) {
    mocks.index = 0;
    const result = ValidationSubject();
    if (flushEffects) for (const effect of mocks.effects.splice(0)) effect();
    return result;
}
function unmount() {
    for (const slot of mocks.slots) slot.cleanup?.();
}
function ValidationSubject() { return useProjectValidation(); }
const report = { projectPath: '/A' } as ProjectValidationReport;

describe('validation panel lifetime', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.project = { projectGeneration: 1, projectPath: '/A' };
        mocks.effects.length = mocks.slots.length = mocks.setups.length = 0;
        mocks.run.mockResolvedValue({ report, status: 'ok' });
    });

    it('shows current success and clears the previous report while rerunning', async () => {
        await render().runValidation();
        expect(render()).toMatchObject({ report, runState: 'ok' });
        const pending = deferred();
        mocks.run.mockReturnValueOnce(pending.promise);
        const running = render().runValidation();
        expect(render()).toMatchObject({ runState: 'running' });
        expect(render().report).toBeUndefined();
        pending.resolve({ report, status: 'issues' });
        await running;
        expect(render()).toMatchObject({ report, runState: 'issues' });
    });

    it.each(['B', 'A', 'B-A', 'closed'] as const)('drops late completion for %s before effect cleanup', async target => {
        const pending = deferred();
        mocks.run.mockReturnValueOnce(pending.promise);
        const running = render().runValidation();
        mocks.project = { projectGeneration: target === 'B-A' ? 3 : 2, projectPath: target === 'closed' ? undefined : (target === 'B' ? '/B' : '/A') };
        expect(render(false)).toMatchObject({ runState: 'idle' });
        expect(mocks.run.mock.calls[0][1]()).toBe(false);
        const setterCount = mocks.setters.mock.calls.length;
        pending.resolve({ report, status: 'ok' });
        await running;
        expect(mocks.setters).toHaveBeenCalledTimes(setterCount);
        expect(render().report).toBeUndefined();
    });

    it('immediately hides a completed report on same-path replacement', async () => {
        await render().runValidation();
        expect(render().report).toBe(report);
        mocks.project.projectGeneration++;
        expect(render(false).report).toBeUndefined();
        expect(render(false).runState).toBe('idle');
    });

    it('retains B when old A completes after B validation', async () => {
        const pending = deferred();
        mocks.run.mockReturnValueOnce(pending.promise);
        const running = render().runValidation();
        mocks.project = { projectGeneration: 2, projectPath: '/B' };
        const nextReport = { projectPath: '/B' } as ProjectValidationReport;
        mocks.run.mockResolvedValueOnce({ report: nextReport, status: 'issues' });
        await render().runValidation();
        pending.resolve({ error: new Error('old A'), status: 'failed' });
        await running;
        expect(render()).toMatchObject({ report: nextReport, runState: 'issues' });
        expect(render().errorMessage).toBeUndefined();
    });

    it('retires callbacks on unmount without setting state after completion', async () => {
        const pending = deferred();
        mocks.run.mockReturnValueOnce(pending.promise);
        const running = render().runValidation();
        unmount();
        expect(mocks.run.mock.calls[0][1]()).toBe(false);
        const count = mocks.setters.mock.calls.length;
        pending.resolve({ report, status: 'ok' });
        await running;
        expect(mocks.setters).toHaveBeenCalledTimes(count);
    });

    it('supersedes an overlapping local request', async () => {
        const pending = deferred();
        mocks.run.mockReturnValueOnce(pending.promise);
        const view = render();
        const first = view.runValidation();
        await view.runValidation();
        expect(mocks.run.mock.calls[0][1]()).toBe(false);
        pending.resolve({ error: new Error('old'), status: 'failed' });
        await first;
        expect(render()).toMatchObject({ report, runState: 'ok' });
    });

    it('does not revive a pending run when effects clean up and set up again', async () => {
        const pending = deferred();
        mocks.run.mockReturnValueOnce(pending.promise);
        const running = render().runValidation();
        unmount();
        for (const setup of mocks.setups) setup();
        expect(mocks.run.mock.calls[0][1]()).toBe(false);
        await render().runValidation();
        pending.resolve({ error: new Error('old effect'), status: 'failed' });
        await running;
        expect(render()).toMatchObject({ report, runState: 'ok' });
    });

    it('clears running state when another entry point retires its run', async () => {
        mocks.run.mockResolvedValueOnce({ status: 'retired' });
        await render().runValidation();
        expect(render()).toMatchObject({ runState: 'idle' });
    });

    it.each(['cancelled', 'failed'] as const)('shows current %s with its reason', async status => {
        mocks.run.mockResolvedValueOnce(status === 'cancelled' ? { message: 'Save conflict', status } : { error: new Error('Missing scene'), status });
        await render().runValidation();
        expect(render()).toMatchObject({ errorMessage: status === 'cancelled' ? 'Save conflict' : 'Missing scene', runState: 'error' });
        expect(render().report).toBeUndefined();
    });

    it('does not submit a stale rendered callback', async () => {
        const view = render();
        mocks.project.projectGeneration++;
        await view.runValidation();
        expect(mocks.run).not.toHaveBeenCalled();
        expect(mocks.setters).not.toHaveBeenCalled();
    });
});
