import type { ReactElement } from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlaytestScenario } from '../playtests/playtestModel';

import { PlaytestPanel } from '../../components/tools/PlaytestPanel';

const harness = vi.hoisted(() => ({
    effects: [] as (() => void)[],
    engine: undefined as { items: { serialize: () => string[] }; stateManager: { state: Record<string, number> } } | undefined,
    index: 0,
    library: { busy: false, message: '', ready: true, save: vi.fn(), scenarios: [] as PlaytestScenario[] },
    playback: { choices: [0, 2], message: '', request: undefined, reset: vi.fn(), visited: [] },
    project: { activeFile: '/A/station.json', items: {}, locales: {}, projectGeneration: 1, projectPath: '/A', scenePaths: { station: '/A/station.json' }, scenes: { station: [{ type: 'wait' }] } },
    slots: [] as unknown[],
    writes: 0,
}));

vi.mock('react', async importOriginal => ({
    ...await importOriginal<typeof import('react')>(),
    useEffect: (setup: () => (() => void) | void, dependencies: unknown[]) => {
        const index = harness.index++;
        const previous = harness.slots[index] as { cleanup?: () => void; dependencies: unknown[] } | undefined;
        if (previous?.dependencies.length === dependencies.length && dependencies.every((value, offset) => Object.is(value, previous.dependencies[offset]))) return;
        previous?.cleanup?.();
        const effect = { cleanup: undefined as (() => void) | undefined, dependencies };
        harness.slots[index] = effect;
        harness.effects.push(() => { effect.cleanup = setup() || undefined; });
    },
    useRef: (initial: unknown) => {
        const index = harness.index++;
        harness.slots[index] ??= { current: initial };
        return harness.slots[index];
    },
    useState: (initial: unknown) => {
        const index = harness.index++;
        if (!(index in harness.slots)) harness.slots[index] = initial;
        return [harness.slots[index], (value: unknown) => {
            harness.writes++;
            harness.slots[index] = typeof value === 'function' ? (value as (previous: unknown) => unknown)(harness.slots[index]) : value;
        }];
    },
}));
vi.mock('../../hooks/usePlaytestLibrary', () => ({ usePlaytestLibrary: () => harness.library }));
vi.mock('../../services/openProjectEntry', () => ({ openProjectEntry: vi.fn() }));
vi.mock('../../store/storeBootstrap', () => ({
    useProjectStore: Object.assign(() => harness.project, { getState: () => harness.project }),
    useScriptStore: { getState: () => ({ selectedNodePath: [3] }) },
}));
vi.mock('../../store/useEditorStore', () => ({ useEditorStore: { getState: () => ({ previewLocale: 'nl' }) } }));
vi.mock('../../store/useEngineBridgeStore', () => ({ useEngineBridgeStore: () => harness.engine }));
vi.mock('../../store/usePlaytestStore', () => ({ usePlaytestStore: Object.assign(() => harness.playback, { getState: () => harness.playback }) }));

type Node = ReactElement<{ 'aria-label'?: string; children?: unknown; onChange: (event: { target: { value: string } }) => void; onClick: () => void; value: string; }>;
const scenario: PlaytestScenario = { choices: [], expectedState: {}, id: 'A', index: 0, inventory: [], name: 'Original A', scene: 'station', state: {} };

async function begin(label = 'Save playtest') {
    button(render(), 'Original A').props.onClick();
    let resolve!: (saved: boolean) => void;
    harness.library.save.mockImplementationOnce(() => new Promise<boolean>(complete => { resolve = complete; }));
    button(render(), label).props.onClick();
    await Promise.resolve();
    return async (saved = true) => {
        resolve(saved);
        await Promise.resolve();
        await Promise.resolve();
        return render();
    };
}

function button(tree: Node, name: string): Node {
    return nodes(tree).find(node => node.type === 'button' && node.props.children === name)!;
}

function input(tree: Node, name = 'Playtest name'): Node {
    return nodes(tree).find(node => node.props['aria-label'] === name)!;
}

function nodes(tree: unknown): Node[] {
    if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
    const node = tree as Node;
    return [node, ...[node.props.children].flat(Infinity).flatMap(child => nodes(child))];
}

function render(): Node {
    harness.index = 0;
    harness.writes = 0;
    const tree = PlaytestPanel() as Node;
    for (const effect of harness.effects.splice(0)) effect();
    return tree;
}

beforeEach(() => {
    harness.effects = [];
    harness.slots = [];
    harness.index = 0;
    harness.engine = undefined;
    harness.library = { busy: false, message: '', ready: true, save: vi.fn(), scenarios: [scenario, { ...scenario, id: 'B', name: 'Original B' }] };
    harness.project.projectGeneration = 1;
    harness.project.projectPath = '/A';
    render();
});

describe('actual playtest panel deferred completions', () => {
    it.each(['Save playtest', 'Delete playtest'])('preserves continued typing during %s', async action => {
        const finish = await begin(action);
        input(render()).props.onChange({ target: { value: 'New unsaved edit' } });
        expect(input(await finish()).props.value).toBe('New unsaved edit');
    });

    it.each(['Save playtest', 'Delete playtest'])('preserves scenario selection during %s', async action => {
        const finish = await begin(action);
        button(render(), 'Original B').props.onClick();
        expect(input(await finish()).props.value).toBe('Original B');
    });

    it('preserves preview state capture during save', async () => {
        const finish = await begin();
        harness.engine = { items: { serialize: () => ['ticket'] }, stateManager: { state: { trust: 9 } } };
        button(render(), 'Capture preview state').props.onClick();
        const tree = await finish();
        expect(input(tree, 'Playtest variables').props.value).toContain('9');
        expect(input(tree, 'Starting command').props.value).toBe(4);
        expect(input(tree, 'Playtest locale').props.value).toBe('nl');
    });

    it('preserves recorded choices during save', async () => {
        const finish = await begin();
        button(render(), 'Use recorded choices').props.onClick();
        expect(input(await finish(), 'Recorded choices').props.value).toBe('[0,2]');
    });

    it('preserves edits after a failed save and suppresses its stale error', async () => {
        const finish = await begin();
        input(render()).props.onChange({ target: { value: 'New unsaved edit' } });
        harness.library.message = 'Obsolete save failure';
        const tree = await finish(false);
        expect(input(tree).props.value).toBe('New unsaved edit');
        expect(nodes(tree).some(node => node.props.children === 'Obsolete save failure')).toBe(false);
    });

    it.each(['/B', '/A'])('retires old completion after project replacement to %s', async path => {
        const finish = await begin();
        harness.project.projectPath = path;
        harness.project.projectGeneration++;
        render();
        input(render()).props.onChange({ target: { value: 'Successor draft' } });
        expect(input(await finish()).props.value).toBe('Successor draft');
    });

    it('retires completion after unmount', async () => {
        const finish = await begin();
        for (const slot of harness.slots) {
            if (slot && typeof slot === 'object' && 'cleanup' in slot) (slot.cleanup as (() => void) | undefined)?.();
        }
        const writes = harness.writes;
        expect(input(await finish()).props.value).toBe('Original A');
        expect(harness.writes).toBe(writes);
    });
});
