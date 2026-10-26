import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectState } from '../../../../store/project/types';
import type { WorkbenchTab } from '../../../../store/workbench/types';

const mocks = vi.hoisted(() => ({
    effect: undefined as (() => () => void) | undefined,
    project: {} as ProjectState,
    read: vi.fn<(paths: string[]) => Promise<Map<string, { text: string }>>>(),
    setResolved: vi.fn(),
    tabs: [] as WorkbenchTab[],
}));
vi.mock('react', () => ({
    useEffect: (effect: () => () => void) => { mocks.effect = effect; },
    useMemo: (factory: () => unknown) => factory(),
    useState: () => [undefined, mocks.setResolved],
}));
vi.mock('../../../../services/storyMap/storyMapFiles', () => ({ readStoryMapFiles: mocks.read }));
vi.mock('../../../../store/storeBootstrap', () => ({ useProjectStore: { getState: () => mocks.project } }));
vi.mock('../../../../store/useWorkbenchStore', () => ({ useWorkbenchStore: { getState: () => ({ tabs: mocks.tabs }) } }));

import { useStoryMap } from '../useStoryMap';

function deferred() {
    let resolve!: (files: Map<string, { text: string }>) => void;
    const promise = new Promise<Map<string, { text: string }>>(complete => { resolve = complete; });
    return { promise, resolve };
}

async function finish(pending: ReturnType<typeof deferred>, text = '[]') {
    pending.resolve(new Map([['/Game/new.json', { text }]]));
    await pending.promise;
}

function StoryMapTest() {
    const map = useStoryMap(mocks.project, mocks.tabs);
    const cleanup = mocks.effect?.();
    if (!cleanup) throw new Error('Missing effect');
    return { cleanup, map };
}

describe('story map asynchronous file ownership', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.project = { macros: {}, manifest: { scenes: { loaded: [] } }, projectGeneration: 1,
            projectPath: '/Game', scenePaths: {}, scenes: { loaded: [] }, treeRevision: 1,
        } as unknown as ProjectState;
        mocks.tabs = [{ dirty: true, id: 'manifest', kind: 'manifest', path: '/Game/game.json',
            textContent: '{"scenes":{"pending":"new.json"},"startScene":"pending"}', title: 'Manifest',
        }];
    });

    it('publishes settled current files and shows unresolved declarations safely while waiting', async () => {
        const pending = deferred();
        mocks.read.mockReturnValue(pending.promise);
        const { map } = StoryMapTest();
        expect(mocks.read).toHaveBeenCalledWith(['/Game/new.json']);
        expect(map.edges).toEqual([]);
        expect(map.nodes).toEqual([expect.objectContaining({ id: 'scene:pending', missing: true })]);
        await finish(pending);
        expect(mocks.setResolved).toHaveBeenCalledWith(expect.objectContaining({ files: new Map([['/Game/new.json', { text: '[]' }]]) }));
    });

    it.each(['projectPath', 'projectGeneration', 'manifest', 'scenes', 'macros', 'scenePaths', 'treeRevision', 'tabs'] as const)('drops late results after %s changes before cleanup', async field => {
        const pending = deferred();
        mocks.read.mockReturnValue(pending.promise);
        StoryMapTest();
        switch (field) {
            case 'projectGeneration': { mocks.project = { ...mocks.project, projectGeneration: 3 }; break;
            }
            case 'projectPath': { mocks.project = { ...mocks.project, projectPath: '/Next' }; break;
            }
            case 'tabs': { mocks.tabs = [...mocks.tabs]; break;
            }
            case 'treeRevision': { mocks.project = { ...mocks.project, treeRevision: 2 }; break;
            }
            default: { mocks.project = { ...mocks.project, [field]: {} }; break;
            }
        }
        await finish(pending);
        expect(mocks.setResolved).not.toHaveBeenCalled();
    });

    it('drops both successful and failed stale reads after cleanup', async () => {
        const pending = deferred();
        mocks.read.mockReturnValue(pending.promise);
        const { cleanup } = StoryMapTest();
        cleanup();
        await finish(pending, '{bad JSON');
        expect(mocks.setResolved).not.toHaveBeenCalled();
    });

    it('keeps a newer inline manifest graph after an older descriptor resolves', async () => {
        const pending = deferred();
        mocks.read.mockReturnValue(pending.promise);
        const older = StoryMapTest();
        mocks.tabs = [{ ...mocks.tabs[0], textContent: '{"scenes":{"current":[]},"startScene":"current"}' }];
        const current = StoryMapTest();
        expect(current.map.nodes.map(node => node.id)).toEqual(['scene:current']);
        expect(mocks.read).toHaveBeenCalledTimes(1);
        await finish(pending, '[{"type":"jump","to":"oldTarget"}]');
        expect(mocks.setResolved).not.toHaveBeenCalled();
        older.cleanup();
        current.cleanup();
    });
});
